#!/usr/bin/env node
import { getCodexStatus } from "./codex.js";
import { runMcpServer } from "./mcp.js";

function parseNumberFlag(name: string): number | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = process.argv[index + 1];
  if (!value) {
    throw new Error(`${name} requires a value.`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number.`);
  }

  return parsed;
}

function printHelp(): void {
  process.stdout.write(`codex-status-mcp

Usage:
  codex-status-mcp                 Start the MCP server over stdio
  codex-status-mcp --once          Print Codex status JSON once

Options:
  --timeout-ms <ms>                Timeout for Codex app-server responses
  --include-email                  Include account email in output
  -h, --help                       Show this help
`);
}

async function main(): Promise<void> {
  if (process.argv.includes("-h") || process.argv.includes("--help")) {
    printHelp();
    return;
  }

  if (process.argv.includes("--once")) {
    const result = await getCodexStatus({
      timeoutMs: parseNumberFlag("--timeout-ms"),
      includeEmail: process.argv.includes("--include-email"),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  await runMcpServer();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
