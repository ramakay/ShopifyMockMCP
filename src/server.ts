#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerShopifyTools } from "./tools.js";
// import { registerShopifyPrompts } from "./prompts.js"; // If we add prompts later
import { readFileSync } from "fs";
import { resolve } from "path";

// Get package.json version directly from root
const packageJsonPath = resolve("./package.json"); // Assumes running from project root
let VERSION = "0.0.0"; // Default version
try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    VERSION = packageJson.version;
} catch (error) {
     // Fallback if reading from root fails (e.g., if run from dist/)
     try {
        const packageJsonDistPath = resolve(__dirname, "../package.json");
        const packageJson = JSON.parse(readFileSync(packageJsonDistPath, "utf8"));
        VERSION = packageJson.version;
     } catch (distError) {
        console.error(`[${new Date().toISOString()}] WARN: Could not read version from ${packageJsonPath} or relative path.`, error, distError); // Keep as error
     }
}


async function main() {
  // Create server instance
  const server = new McpServer(
    {
      name: "shopify-mcp-proxy", // Match package name scope if desired later
      version: VERSION,
      // Add other server info as needed
    },
    {
      capabilities: {
        // Declare server capabilities, e.g., logging
        logging: {},
        // completions: {} // If we add argument completion support later
      },
    }
  );

  // Register Shopify tools
  registerShopifyTools(server); // Call the function from tools.ts

  // Register Shopify prompts (if any)
  // registerShopifyPrompts(server);

  // Connect to transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Use stderr for server status messages as stdout is for JSON-RPC
  console.error(`[${new Date().toISOString()}] INFO: Shopify MCP Proxy Server v${VERSION} running on stdio`); // Added INFO level
}

main().catch((error) => {
  console.error(`[${new Date().toISOString()}] FATAL: Server encountered an unhandled error:`, error); // Keep as error
  process.exit(1);
});