# codex-status-mcp

Check your current Codex usage and rate-limit status from Claude Code, Codex, or any MCP client.

`codex-status-mcp` solves a small visibility problem: Codex already knows your ChatGPT account and
current Codex rate-limit windows, but that status is not exposed as a simple MCP tool for another
agent to query during a session.

```sh
codex mcp add codex-status-mcp -- npx -y codex-status-mcp --mcp
```

This package fills that gap. It starts Codex's local app-server, asks it for the current account and
rate-limit status, and returns the status JSON directly.

## Demo

<img src="https://raw.githubusercontent.com/DrSmile444/codex-status-mcp/main/docs/codex-usage-demo.png" alt="Codex usage shown as a table in an MCP client" width="540">

## Features

- Uses Codex's own app-server account API instead of local session telemetry.
- Respects usage from the ChatGPT account Codex is logged into, not just one local device.
- `--pretty` flag for a human-readable terminal summary with progress bars.
- Exposes a single MCP tool: `get_codex_status`.
- Returns primary and secondary Codex rate-limit windows with usage percentage and reset time.
- Returns Codex credits status and whether a rate limit has been reached.
- Redacts the account email by default.
- Does not read, store, log, or print your Codex access token.

## Quick Start

Print your current Codex status in a terminal:

```sh
npx codex-status-mcp
```

Pretty-print for humans:

```sh
npx codex-status-mcp --pretty
```

Add it to Claude Code:

```sh
claude mcp add --scope user codex-status-mcp -- npx -y codex-status-mcp --mcp
```

Add it to Codex:

```sh
codex mcp add codex-status-mcp -- npx -y codex-status-mcp --mcp
```

After adding the MCP server, restart Claude Code or Codex. Most MCP clients load servers when a new
session starts.

Then ask your MCP client something like:

```text
What is my current Codex status?
```

## Programmatic Usage

Install the package and import directly:

```sh
npm install codex-status-mcp
```

```typescript
import { getCodexStatus } from "codex-status-mcp";

const result = await getCodexStatus();
console.log(result.rateLimits?.primary?.usedPercent); // e.g. 45
```

With options:

```typescript
import { getCodexStatus } from "codex-status-mcp";

const result = await getCodexStatus({
  timeoutMs: 30000,
  includeEmail: true,
});
```

The package exports:
- `getCodexStatus(options?)` — fetch current Codex status; returns `CodexStatusResult`
- `CodexStatusError` — thrown when the Codex app-server returns an error or times out
- `DEFAULT_TIMEOUT_MS` — default timeout (15 000 ms)

## Requirements

- Node.js 18 or newer.
- Codex CLI installed and available on `PATH`.
- Codex logged in with ChatGPT on the machine running the MCP server.

Check Codex login status:

```sh
codex login status
```

If not logged in:

```sh
codex login
```

## CLI Usage

Print current status:

```sh
npx codex-status-mcp
```

Example output:

```json
{
  "source": "codex app-server account/rateLimits/read",
  "account": {
    "type": "chatgpt",
    "email": "<redacted>",
    "planType": "plus"
  },
  "requiresOpenaiAuth": true,
  "rateLimits": {
    "limitId": "codex",
    "limitName": null,
    "primary": {
      "usedPercent": 10,
      "windowDurationMins": 300,
      "resetsAt": 1779752562,
      "resetsAtIso": "2026-05-25T23:42:42.000Z"
    },
    "secondary": {
      "usedPercent": 2,
      "windowDurationMins": 10080,
      "resetsAt": 1780339362,
      "resetsAtIso": "2026-06-01T18:42:42.000Z"
    },
    "credits": {
      "hasCredits": false,
      "unlimited": false,
      "balance": "0"
    },
    "planType": "plus",
    "rateLimitReachedType": null
  },
  "rateLimitsByLimitId": {
    "codex": {
      "limitId": "codex",
      "limitName": null,
      "primary": {
        "usedPercent": 10,
        "windowDurationMins": 300,
        "resetsAt": 1779752562,
        "resetsAtIso": "2026-05-25T23:42:42.000Z"
      },
      "secondary": {
        "usedPercent": 2,
        "windowDurationMins": 10080,
        "resetsAt": 1780339362,
        "resetsAtIso": "2026-06-01T18:42:42.000Z"
      },
      "credits": {
        "hasCredits": false,
        "unlimited": false,
        "balance": "0"
      },
      "planType": "plus",
      "rateLimitReachedType": null
    }
  }
}
```

Include the account email:

```sh
npx codex-status-mcp --include-email
```

Use a custom timeout:

```sh
npx codex-status-mcp --timeout-ms 30000
```

Show CLI help:

```sh
npx codex-status-mcp --help
```

### Pretty output

```sh
npx codex-status-mcp --pretty
```

```
Codex Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Account
  Plan:   plus
  Email:  <redacted>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rate Limits

  Primary (5h window)
    [██████████░░░░░░░░░░] 49% used, 51% remaining
    Resets in: 4h 46m

  Secondary (7d window)
    [█████░░░░░░░░░░░░░░░] 23% used, 77% remaining
    Resets in: 156h 22m
```

### All flags

```sh
npx codex-status-mcp [options]

Options:
  --pretty               Human-readable summary with progress bars instead of JSON.
  --include-email        Include account email in output.
  --timeout-ms <ms>      Timeout for API requests (default: 15000).
  --mcp                  Run as an MCP stdio server.
  --help, -h             Show help.
```

## MCP Setup

The MCP server exposes one tool:

```text
get_codex_status
```

It returns the same JSON as the CLI. The tool accepts two optional arguments:

```json
{
  "timeoutMs": 15000,
  "includeEmail": false
}
```

### Claude Code

Add the published package:

```sh
claude mcp add --scope user codex-status-mcp -- npx -y codex-status-mcp --mcp
```

Verify:

```sh
claude mcp list
claude mcp get codex-status-mcp
```

Equivalent MCP JSON:

```json
{
  "mcpServers": {
    "codex-status-mcp": {
      "command": "npx",
      "args": ["-y", "codex-status-mcp", "--mcp"]
    }
  }
}
```

### Codex

Add the published package:

```sh
codex mcp add codex-status-mcp -- npx -y codex-status-mcp --mcp
```

Verify:

```sh
codex mcp list
codex mcp get codex-status-mcp --json
```

Codex writes this to `~/.codex/config.toml`:

```toml
[mcp_servers.codex-status-mcp]
command = "npx"
args = ["-y", "codex-status-mcp", "--mcp"]
```

### Other MCP Clients

Use the same stdio server command:

```json
{
  "mcpServers": {
    "codex-status-mcp": {
      "command": "npx",
      "args": ["-y", "codex-status-mcp", "--mcp"]
    }
  }
}
```

## How It Works

`codex-status-mcp` is a thin wrapper around Codex's own local app-server.

This package does not read local Codex session history or SQLite telemetry. Local files only reflect
one installation, so they undercount usage across other devices and Codex surfaces.

When you run the CLI smoke test or call the MCP tool, it starts:

```sh
codex app-server --listen stdio://
```

Then it speaks JSON-RPC over stdin/stdout:

```text
initialize
account/read
account/rateLimits/read
```

The quota data comes from Codex's app-server account API. Codex handles the existing ChatGPT login
and refresh behavior internally. This package does not read or print your Codex access token.

By default, the command prints the result to stdout and exits. With `--mcp`, the process stays alive
because the MCP client manages it over stdio.

### Evidence

The implementation is based on these official/source references:

- OpenAI's Codex app-server README documents that `codex app-server` supports JSON-RPC over stdio
  with `--listen stdio://`, and that clients must call `initialize` before using the API:
  <https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md#protocol>
- The same README documents the account endpoints used here:
  `account/read` fetches current account info, and `account/rateLimits/read` fetches ChatGPT rate
  limits:
  <https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md#auth-endpoints>
- The rate-limit section documents the returned fields this package normalizes: `usedPercent`,
  `windowDurationMins`, `resetsAt`, and `rateLimitReachedType`:
  <https://github.com/openai/codex/blob/main/codex-rs/app-server/README.md#7-rate-limits-chatgpt>
- OpenAI's Help Center says Codex usage limits vary by ChatGPT plan, count toward agentic usage,
  and can be checked through the Codex usage page or limit banner:
  <https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan>
- The Codex pricing page says current limits are available in the Codex usage dashboard and that
  local messages and cloud tasks share a five-hour usage window:
  <https://chatgpt.com/codex/pricing/>

## Local Checkout Setup

Use these commands when working from a cloned copy of this repository before publishing to npm.

Install and build:

```sh
npm install
npm run build
```

Run the local CLI smoke test:

```sh
node dist/cli.js
```

Run the local MCP server:

```sh
node dist/cli.js --mcp
```

### Claude Code From Local Checkout

Use the compiled entrypoint:

```sh
claude mcp add --scope user codex-status-mcp -- node /absolute/path/to/codex-status-mcp/dist/cli.js --mcp
```

Or run TypeScript directly with `tsx`:

```sh
claude mcp add --scope user codex-status-mcp -- npx tsx /absolute/path/to/codex-status-mcp/src/cli.ts --mcp
```

### Codex From Local Checkout

Use the compiled entrypoint:

```sh
codex mcp add codex-status-mcp -- node /absolute/path/to/codex-status-mcp/dist/cli.js --mcp
```

Or run TypeScript directly with `tsx`:

```sh
codex mcp add codex-status-mcp -- npx tsx /absolute/path/to/codex-status-mcp/src/cli.ts --mcp
```

## Development

Install dependencies:

```sh
npm install
```

Print status from TypeScript:

```sh
npm run status
```

Run the MCP server from TypeScript:

```sh
npm run dev
```

Build:

```sh
npm run build
```

Typecheck:

```sh
npm run typecheck
```

Preview the npm package:

```sh
npm pack --dry-run
```

## Troubleshooting

### Codex App-Server Cannot Start

Make sure Codex CLI is installed and available on `PATH`:

```sh
codex --version
```

### Codex Is Not Logged In

Make sure Codex is logged in with ChatGPT on this machine:

```sh
codex login status
```

If needed, log in:

```sh
codex login
```

### MCP Tool Does Not Show Up

Restart Claude Code, Codex, or your MCP client after adding the server. Most MCP clients discover
tools only when a new session starts.

### MCP Tool Times Out

Increase the timeout:

```json
{
  "timeoutMs": 30000
}
```

## Security Notes

This package asks Codex's app-server for account status. Codex handles your ChatGPT auth internally.

- Do not commit Codex auth files.
- Do not paste tokens into shared logs.
- Account email is redacted by default.
- Use `includeEmail` only when you explicitly need the email in the result.
- The package returns account and rate-limit metadata, not the token value.

## Related Packages

These packages are part of the same family of AI provider status tools:

- [claude-status-mcp](https://github.com/DrSmile444/claude-status-mcp) — Claude OAuth usage and rate-limit windows
- [copilot-status-mcp](https://github.com/DrSmile444/copilot-status-mcp) — GitHub Copilot session, weekly, and monthly quota
- [provider-status-mcp](https://github.com/DrSmile444/provider-status-mcp) — Aggregates Claude, Codex, and Copilot status into a single view

## License

MIT

---

Made with ❤️ by Dmytro Vakulenko, 2026
