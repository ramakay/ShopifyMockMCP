# Shopify MCP Proxy & Mock Server (ShopifyMCPMockShop)

This project implements a Model Context Protocol (MCP) server that acts as an intelligent bridge and proxy to Shopify's APIs (Storefront and optionally Admin). It uniquely supports `mock.shop` for safe development and testing, provides granular action-oriented tools, and utilizes `ToolAnnotations` for enhanced safety.

## Setup & Running Locally

This server is built using Next.js and runs as an HTTP service.

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd ShopifyMCPMockShop/app
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Configure Environment:**
    *   Copy `.env.local.example` (if provided, otherwise create `.env.local`) in the `app` directory.
    *   Fill in the necessary environment variables:
        *   `SHOPIFY_STORE`: Your store domain (e.g., `your-store.myshopify.com`). Leave blank to use `mock.shop`.
        *   `SHOPIFY_ACCESS_TOKEN`: Your Storefront API access token (required if `SHOPIFY_STORE` is set).
        *   `SHOPIFY_VERSION`: Optional specific Storefront API version (e.g., `2025-04`). Defaults to latest stable.
        *   `USE_ADMIN_API`: Set to `true` or `1` to enable Admin API tools.
        *   `ADMIN_ACCESS_TOKEN`: Your Admin API access token (required if `USE_ADMIN_API` is true).
        *   `ADMIN_VERSION`: Optional specific Admin API version (e.g., `2025-04`). Defaults to latest stable.
4.  **Run the development server:**
    ```bash
    npm run dev -- -p <PORT>
    ```
    (Replace `<PORT>` with your desired port, e.g., `52000`. Defaults to `3000` if `-p` is omitted). The MCP endpoint will be available at `http://localhost:<PORT>/api/mcp`.

## Usage with Cursor or Claude Desktop

Add the following configuration to your client, replacing the URL with your local or deployed endpoint. For more information, read the [Cursor MCP documentation](https://docs.cursor.com/context/model-context-protocol) or the [Claude Desktop MCP guide](https://modelcontextprotocol.io/quickstart/user).

**Local Development:**

```json
{
  "mcpServers": {
    "shopify-mcp-proxy": {
      "url": "http://localhost:52000/api/mcp"
    }
  }
}
```
*(Adjust port if necessary)*

**Deployed (Example Vercel URL):**

```json
{
  "mcpServers": {
    "shopify-mcp-proxy": {
      "url": "https://your-app-name.vercel.app/api/mcp"
    }
  }
}
```

## Available Tools

This MCP server provides tools for interacting with the Shopify Storefront API and (optionally) the Admin API. Tools include safety annotations (`readonly`, `destructive`, `idempotent`).

| Tool Name           | Description                                                                 | API      | Annotations                                          |
| :------------------ | :-------------------------------------------------------------------------- | :------- | :--------------------------------------------------- |
| `getShopInfo`       | Fetches basic shop details (name, description, currency).                   | Storefront | `{ readonly: true }`                                 |
| `getProductById`    | Fetches a specific product by ID, optionally including variants/images.     | Storefront | `{ readonly: true }`                                 |
| `findProducts`      | Searches/filters products with pagination/sorting.                          | Storefront | `{ readonly: true }`                                 |
| `getCollectionById` | Fetches a specific collection by ID, optionally including products.         | Storefront | `{ readonly: true }`                                 |
| `findCollections`   | Searches/filters collections with pagination/sorting.                       | Storefront | `{ readonly: true }`                                 |
| `cartCreate`        | Creates a new shopping cart.                                                | Storefront | `{ readonly: false, destructive: false, idempotent: false }` |
| `cartLinesAdd`      | Adds line items to an existing shopping cart.                               | Storefront | `{ readonly: false, destructive: false, idempotent: false }` |
| `cartLinesUpdate`   | Updates line items (e.g., quantity) in an existing shopping cart.           | Storefront | `{ readonly: false, destructive: false, idempotent: true }`  |
| `cartLinesRemove`   | Removes line items from an existing shopping cart.                          | Storefront | `{ readonly: false, destructive: false, idempotent: true }`  |
| `getCart`           | Fetches the details of an existing shopping cart by ID.                     | Storefront | `{ readonly: true }`                                 |
| `getCustomerById`   | *(Admin API)* Retrieves a specific customer by ID.                          | Admin    | `{ readonly: true }`                                 |
| `createProduct`     | *(Admin API)* Creates a new product.                                       | Admin    | `{ readonly: false, destructive: false, idempotent: false }` |
| `example...`        | *(Placeholders for testing/example)*                                       | Store/Admin| *(Varies)*                                           |

*(Note: Admin API tools are only available if `USE_ADMIN_API` is enabled and configured correctly.)*

## Available Prompts

*(Currently, no specific prompts are defined. This section can be added later.)*

## Development

The server is built using Next.js within the `app` directory.

1.  Navigate to the `app` directory: `cd app`
2.  Install dependencies: `npm install`
3.  Modify source files in `app/src/...`
4.  Run the development server: `npm run dev` (optionally with `-p <PORT>`)
5.  Build for production: `npm run build`
6.  Run tests: `npm run test` *(Testing framework setup is pending)*

## License

*(License to be determined - Assuming MIT for now)*
MIT License