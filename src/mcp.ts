import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { DEFAULT_TIMEOUT_MS, getCodexStatus } from "./codex.js";

const GET_CODEX_STATUS_TOOL = "get_codex_status";

interface GetCodexStatusArguments {
  timeoutMs?: number;
  includeEmail?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function parseArguments(value: unknown): GetCodexStatusArguments | undefined {
  if (value === undefined || value === null) {
    return {};
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const { timeoutMs, includeEmail } = value;
  if (timeoutMs !== undefined && typeof timeoutMs !== "number") {
    return undefined;
  }

  if (includeEmail !== undefined && typeof includeEmail !== "boolean") {
    return undefined;
  }

  return {
    timeoutMs,
    includeEmail,
  };
}

export async function runMcpServer(): Promise<void> {
  const server = new Server(
    {
      name: "codex-status-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: GET_CODEX_STATUS_TOOL,
        description:
          "Retrieve current Codex ChatGPT account status, usage percentage, rate-limit windows, and credits.",
        inputSchema: {
          type: "object",
          properties: {
            timeoutMs: {
              type: "number",
              description: `Optional timeout in milliseconds. Defaults to ${DEFAULT_TIMEOUT_MS}.`,
            },
            includeEmail: {
              type: "boolean",
              description:
                "Return the account email instead of redacting it. Defaults to false.",
            },
          },
          additionalProperties: false,
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== GET_CODEX_STATUS_TOOL) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${request.params.name}`,
          },
        ],
        isError: true,
      };
    }

    const args = parseArguments(request.params.arguments);
    if (!args) {
      return {
        content: [
          {
            type: "text",
            text: "Invalid arguments. timeoutMs must be a number and includeEmail must be a boolean when provided.",
          },
        ],
        isError: true,
      };
    }

    try {
      const result = await getCodexStatus(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
