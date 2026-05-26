#!/usr/bin/env node
import { getCodexStatus } from "./codex.js";
import { runMcpServer } from "./mcp.js";

interface CliOptions {
  mcp: boolean;
  once: boolean;
  timeoutMs?: number;
  includeEmail: boolean;
  help: boolean;
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
  --help, -h             Show this help message.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mcp: false,
    once: false,
    includeEmail: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--mcp":
        options.mcp = true;
        break;
      case "--once":
        options.once = true;
        break;
      case "--include-email":
        options.includeEmail = true;
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
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
