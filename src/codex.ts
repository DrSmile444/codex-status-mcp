import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export const DEFAULT_TIMEOUT_MS = 15_000;

export class CodexStatusError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CodexStatusError";
  }
}

export interface CodexStatusOptions {
  timeoutMs?: number;
  includeEmail?: boolean;
}

interface JsonRpcResponse {
  id?: number;
  result?: unknown;
  error?: unknown;
}

export interface CodexAccount {
  type?: string;
  email?: string;
  planType?: string | null;
  [key: string]: unknown;
}

export interface RateLimitWindow {
  usedPercent?: number;
  windowDurationMins?: number;
  resetsAt?: number;
  resetsAtIso?: string | null;
  [key: string]: unknown;
}

export interface RateLimits {
  limitId?: string;
  limitName?: string | null;
  primary?: RateLimitWindow | null;
  secondary?: RateLimitWindow | null;
  credits?: unknown;
  planType?: string | null;
  rateLimitReachedType?: string | null;
  [key: string]: unknown;
}

interface AccountReadResult {
  account?: CodexAccount | null;
  requiresOpenaiAuth?: boolean;
}

interface RateLimitsReadResult {
  rateLimits?: RateLimits | null;
  rateLimitsByLimitId?: Record<string, RateLimits>;
}

export interface CodexStatusResult {
  source: "codex app-server account/rateLimits/read";
  account: CodexAccount | null;
  requiresOpenaiAuth: boolean | null;
  rateLimits: RateLimits | null;
  rateLimitsByLimitId: Record<string, RateLimits | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function asAccountReadResult(value: unknown): AccountReadResult {
  return isRecord(value) ? value : {};
}

function asRateLimitsReadResult(value: unknown): RateLimitsReadResult {
  return isRecord(value) ? value : {};
}

function redactAccount(account: CodexAccount | null | undefined, includeEmail: boolean): CodexAccount | null {
  if (!account) {
    return null;
  }

  if (includeEmail) {
    return account;
  }

  return {
    ...account,
    email: typeof account.email === "string" ? "<redacted>" : account.email,
  };
}

function unixSecondsToIso(value: unknown): string | null {
  return typeof value === "number" ? new Date(value * 1000).toISOString() : null;
}

function normalizeWindow(window: RateLimitWindow | null | undefined): RateLimitWindow | null {
  if (!window) {
    return null;
  }

  return {
    ...window,
    resetsAtIso: unixSecondsToIso(window.resetsAt),
  };
}

function normalizeRateLimits(rateLimits: RateLimits | null | undefined): RateLimits | null {
  if (!rateLimits) {
    return null;
  }

  return {
    ...rateLimits,
    primary: normalizeWindow(rateLimits.primary),
    secondary: normalizeWindow(rateLimits.secondary),
  };
}

function sendJson(
  child: ChildProcessWithoutNullStreams,
  id: number,
  method: string,
  params: Record<string, unknown>,
): void {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
}

function parseTimeoutMs(value: number | undefined): number {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new CodexStatusError("timeoutMs must be a positive finite number.");
  }

  return value;
}

export async function getCodexStatus(options: CodexStatusOptions = {}): Promise<CodexStatusResult> {
  const timeoutMs = parseTimeoutMs(options.timeoutMs);

  return await new Promise((resolve, reject) => {
    const child = spawn("codex", ["app-server", "--listen", "stdio://"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    let stderrBuffer = "";
    const responses = new Map<number, JsonRpcResponse>();
    let settled = false;

    const finish = (error?: unknown, result?: CodexStatusResult): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      child.kill("SIGTERM");

      if (error) {
        reject(error);
      } else if (result) {
        resolve(result);
      } else {
        reject(new CodexStatusError("Codex app-server did not return usage data."));
      }
    };

    const timeout = setTimeout(() => {
      finish(
        new CodexStatusError("Timed out waiting for Codex app-server status data.", {
          stderr: stderrBuffer.trim(),
          receivedResponseIds: [...responses.keys()],
        }),
      );
    }, timeoutMs);

    child.on("error", (error) => {
      finish(
        new CodexStatusError(
          "Failed to start `codex app-server`. Install Codex CLI and ensure `codex` is on PATH.",
          { cause: error.message },
          { cause: error },
        ),
      );
    });

    child.on("exit", (code, signal) => {
      if (settled) {
        return;
      }

      finish(
        new CodexStatusError("Codex app-server exited before returning status data.", {
          code,
          signal,
          stderr: stderrBuffer.trim(),
          receivedResponseIds: [...responses.keys()],
        }),
      );
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
    });

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();

      let newlineIndex: number;
      while ((newlineIndex = stdoutBuffer.indexOf("\n")) >= 0) {
        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        if (!line) {
          continue;
        }

        let message: JsonRpcResponse;
        try {
          message = JSON.parse(line) as JsonRpcResponse;
        } catch {
          continue;
        }

        if (typeof message.id === "number") {
          responses.set(message.id, message);
        }

        const accountResponse = responses.get(2);
        const rateLimitsResponse = responses.get(3);
        if (!accountResponse || !rateLimitsResponse) {
          continue;
        }

        if (accountResponse.error || rateLimitsResponse.error) {
          finish(
            new CodexStatusError("Codex app-server returned a JSON-RPC error.", {
              accountError: accountResponse.error,
              rateLimitsError: rateLimitsResponse.error,
            }),
          );
          return;
        }

        const accountResult = asAccountReadResult(accountResponse.result);
        const limitsResult = asRateLimitsReadResult(rateLimitsResponse.result);
        const rateLimitsByLimitId: Record<string, RateLimits | null> = {};

        for (const [limitId, value] of Object.entries(limitsResult.rateLimitsByLimitId ?? {})) {
          rateLimitsByLimitId[limitId] = normalizeRateLimits(value);
        }

        finish(undefined, {
          source: "codex app-server account/rateLimits/read",
          account: redactAccount(accountResult.account, options.includeEmail === true),
          requiresOpenaiAuth: accountResult.requiresOpenaiAuth ?? null,
          rateLimits: normalizeRateLimits(limitsResult.rateLimits),
          rateLimitsByLimitId,
        });
      }
    });

    sendJson(child, 1, "initialize", {
      clientInfo: { name: "codex-status-mcp", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "initialized", params: {} })}\n`);
    sendJson(child, 2, "account/read", { refreshToken: false });
    sendJson(child, 3, "account/rateLimits/read", {});
  });
}
