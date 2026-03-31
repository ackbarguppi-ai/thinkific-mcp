#!/usr/bin/env node

/**
 * Thinkific MCP Server — main entry point.
 *
 * Launches a Model Context Protocol server over stdio that exposes
 * Thinkific REST API operations as MCP tools and resources.
 *
 * @module index
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveAuth, ThinkificClient } from "./client.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";
import { registerGraphQLTools } from "./graphql-tools.js";
import { metrics } from "./metrics.js";

const VERSION = "1.1.0";

/**
 * Bootstrap and start the MCP server.
 *
 * 1. Resolve authentication from environment variables.
 * 2. Create the Thinkific API client.
 * 3. Register all tools and resources.
 * 4. Connect via stdio transport.
 */
async function main(): Promise<void> {
  const startTime = performance.now();
  
  // Resolve auth config — will throw with a helpful message if not configured
  const auth = resolveAuth();

  // Create client with optimized settings
  const client = new ThinkificClient(auth, {
    enableCache: true,
    cacheTTL: 10000, // 10 second default cache
    maxRetries: 3,
    requestTimeout: 30000,
  });

  const server = new McpServer({
    name: "thinkific-mcp-server",
    version: VERSION,
  });

  // Register all tools and resources
  registerTools(server, client);
  registerGraphQLTools(server, client);
  registerResources(server, client);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  const startupTime = performance.now() - startTime;
  console.error(
    `Thinkific MCP server v${VERSION} started (${startupTime.toFixed(1)}ms)`,
  );
  console.error(`Auth: ${auth.mode}, Cache: enabled, Transport: stdio`);
}

main().catch((err) => {
  console.error("Fatal error starting Thinkific MCP server:", err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.error('\nShutting down...');
  console.error(metrics.formatReport());
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\nShutting down...');
  console.error(metrics.formatReport());
  process.exit(0);
});
