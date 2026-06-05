#!/usr/bin/env node
import { getCodexStatus, type CodexStatusResult } from "./codex.js";
import { runMcpServer } from "./mcp.js";

interface CliOptions {
  mcp: boolean;
  timeoutMs?: number;
  includeEmail: boolean;
  help: boolean;
  pretty: boolean;
}

function printHelp(): void {
  process.stdout.write(`codex-status-mcp

Fetch current Codex status or run as an MCP stdio server.

Usage:
  codex-status-mcp [--timeout-ms <ms>] [--include-email]
  codex-status-mcp --mcp
  codex-status-mcp --help

Options:
  --mcp                  Run the MCP server over stdio.
  --timeout-ms <ms>      Timeout for Codex app-server responses.
  --include-email        Include account email in output.
  --pretty               Render a human-friendly summary instead of JSON.
  --help, -h             Show this help message.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mcp: false,
    includeEmail: false,
    help: false,
    pretty: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--mcp":
        options.mcp = true;
        break;
      case "--include-email":
        options.includeEmail = true;
        break;
      case "--pretty":
        options.pretty = true;
        break;
      case "--timeout-ms": {
        index += 1;
        if (!argv[index]) {
          throw new Error("--timeout-ms requires a value.");
        }
        const parsed = Number(argv[index]);
        if (!Number.isFinite(parsed)) {
          throw new Error("--timeout-ms must be a number.");
        }
        options.timeoutMs = parsed;
        break;
      }
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function humanDiff(isoDate: string): string {
  const diffSecs = Math.round((new Date(isoDate).getTime() - Date.now()) / 1000);
  if (diffSecs <= 0) return "already passed";
  const h = Math.floor(diffSecs / 3600);
  const m = Math.floor((diffSecs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function buildBar(usedPercent: number, width = 20): string {
  const filled = Math.round((usedPercent / 100) * width);
  return `[${"█".repeat(filled)}${"░".repeat(width - filled)}]`;
}

function windowLabel(windowDurationMins: number | undefined): string {
  if (windowDurationMins === 300) return "5h window";
  if (windowDurationMins === 10080) return "7d window";
  if (windowDurationMins !== undefined) {
    const h = Math.round(windowDurationMins / 60);
    return `${h}h window`;
  }
  return "window";
}

function printPretty(result: CodexStatusResult): void {
  const divider = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";

  process.stdout.write("Codex Status\n");
  process.stdout.write(divider);

  // Account section
  process.stdout.write("Account\n");
  const account = result.account;
  if (account) {
    const plan = account.planType ?? account.type ?? "unknown";
    process.stdout.write(`  Plan:   ${plan}\n`);
    if (account.email) {
      process.stdout.write(`  Email:  ${account.email}\n`);
    }
  } else {
    process.stdout.write("  (no account data)\n");
  }

  process.stdout.write(divider);

  // Rate Limits section
  process.stdout.write("Rate Limits\n");
  const rl = result.rateLimits;
  if (rl) {
    if (rl.rateLimitReachedType != null) {
      process.stdout.write(`  ⛔ RATE LIMITED (${rl.rateLimitReachedType})\n`);
    }

    for (const [key, label] of [["primary", "Primary"], ["secondary", "Secondary"]] as const) {
      const win = rl[key];
      if (!win) continue;
      const used = win.usedPercent ?? 0;
      const remaining = 100 - used;
      const wLabel = windowLabel(win.windowDurationMins);
      const bar = buildBar(used);
      const resetStr = win.resetsAtIso ? humanDiff(win.resetsAtIso) : "unknown";
      process.stdout.write(`\n  ${label} (${wLabel})\n`);
      process.stdout.write(`    ${bar} ${used}% used, ${remaining}% remaining\n`);
      process.stdout.write(`    Resets in: ${resetStr}\n`);
    }

    // Credits section
    const credits = rl.credits as { hasCredits?: boolean; balance?: string; unlimited?: boolean } | null | undefined;
    if (credits?.hasCredits) {
      process.stdout.write(divider);
      process.stdout.write("Credits\n");
      if (credits.unlimited) {
        process.stdout.write("  Unlimited credits\n");
      } else {
        process.stdout.write(`  Balance: ${credits.balance ?? "0"}\n`);
      }
    }
  } else {
    process.stdout.write("  (no rate limit data)\n");
  }

  process.stdout.write("\n");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.mcp) {
    await runMcpServer();
    return;
  }

  const result = await getCodexStatus({
    timeoutMs: options.timeoutMs,
    includeEmail: options.includeEmail,
  });
  if (options.pretty) {
    printPretty(result);
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
