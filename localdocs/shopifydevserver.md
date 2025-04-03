This file is a merged representation of the entire codebase, combined into a single document by Repomix.
The content has been processed where security check has been disabled.

<file_summary>
This section contains a summary of this file.

<purpose>
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.
</purpose>

<file_format>
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files, each consisting of:
  - File path as an attribute
  - Full contents of the file
</file_format>

<usage_guidelines>
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.
</usage_guidelines>

<notes>
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Security check has been disabled - content may contain sensitive information
- Files are sorted by Git change count (files with more changes are at the bottom)
</notes>

<additional_info>

</additional_info>

</file_summary>

<directory_structure>
__mocks__/
  fs/
    promises.cjs
  fs.cjs
.github/
  workflows/
    cla.yml
    publish.yml
    remove-labels-on-activity.yml
    stale.yml
    test.yml
  CODEOWNERS
src/
  prompts/
    index.ts
  tools/
    index.ts
    shopify-admin-schema.test.ts
    shopify-admin-schema.ts
    shopify.test.ts
  index.ts
.gitignore
CODE_OF_CONDUCT.md
CONTRIBUTING.md
LICENSE
package.json
README.md
tsconfig.json
vitest.config.js
</directory_structure>

<files>
This section contains the contents of the repository's files.

<file path="__mocks__/fs/promises.cjs">
const { fs } = require("memfs");
module.exports = fs.promises;
</file>

<file path="__mocks__/fs.cjs">
const { fs } = require("memfs");
module.exports = fs;
</file>

<file path=".github/workflows/cla.yml">
name: Contributor License Agreement (CLA)

on:
  pull_request_target:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  cla:
    runs-on: ubuntu-latest
    if: |
      (github.event.issue.pull_request
        && !github.event.issue.pull_request.merged_at
        && contains(github.event.comment.body, 'signed')
      )
      || (github.event.pull_request && !github.event.pull_request.merged)
    steps:
      - uses: Shopify/shopify-cla-action@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          cla-token: ${{ secrets.CLA_TOKEN }}
</file>

<file path=".github/workflows/publish.yml">
name: Publish Package to npm

on:
  release:
    types: [created]

jobs:
  build-and-publish:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Check version matches
        run: |
          PACKAGE_VERSION=$(node -p "require('./package.json').version")
          TAG_VERSION=${GITHUB_REF#refs/tags/v}
          if [ "$PACKAGE_VERSION" != "$TAG_VERSION" ]; then
            echo "Package version ($PACKAGE_VERSION) doesn't match tag version ($TAG_VERSION)"
            exit 1
          fi

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
</file>

<file path=".github/workflows/remove-labels-on-activity.yml">
name: Remove Stale or Waiting Labels
on:
  issue_comment:
    types: [created]
  workflow_dispatch:
jobs:
  remove-labels-on-activity:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions-ecosystem/action-remove-labels@v1
        if: contains(github.event.issue.labels.*.name, 'Waiting for Response')
        with:
          labels: |
            Waiting for Response
</file>

<file path=".github/workflows/stale.yml">
name: Close inactive issues
on:
  schedule:
    - cron: "30 1 * * *"

jobs:
  close-issues:
    runs-on: ubuntu-latest
    permissions:
      issues: write
      pull-requests: write
    steps:
      - uses: actions/stale@v5
        with:
          days-before-issue-stale: 60
          operations-per-run: 1000
          stale-issue-label: "Stale"
          stale-issue-message: |
            We're labeling this issue as stale because there hasn't been any activity on it for 60 days. While the issue will stay open and we hope to resolve it, this helps us prioritize community requests.

            You can add a comment to remove the label if it's still relevant, and we can re-evaluate it.
          days-before-issue-close: -1
          days-before-pr-stale: -1
          days-before-pr-close: -1
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          exempt-issue-labels: "feature request"
</file>

<file path=".github/workflows/test.yml">
name: Run Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test
</file>

<file path=".github/CODEOWNERS">
*       @shopify/core-build-learn
package.json
pnpm-lock.yaml
</file>

<file path="src/prompts/index.ts">
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function shopifyPrompts(server: McpServer) {
  server.prompt(
    "shopify_admin_graphql",
    {
      query: z
        .string()
        .describe("The specific Shopify Admin API question or request"),
    },
    ({ query }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `I need help writing a GraphQL operation for the Shopify Admin API.

Here is my specific request: ${query}

Please help me create a complete and correct GraphQL operation (query or mutation) for the Shopify Admin API that accomplishes this task. Include:
1. The full GraphQL operation with proper syntax
2. A brief explanation of what each part of the operation does
3. Any variables needed for the operation
4. How to handle the response data
5. Relevant documentation links if applicable

When formulating your response, make sure to:
- Use the latest Shopify Admin API best practices
- Structure the query efficiently, requesting only necessary fields
- Follow proper naming conventions for the GraphQL operation
- Handle error cases appropriately
- Ensure the query is optimized for performance

The GraphQL operation should be ready to use with minimal modification.`,
          },
        },
      ],
    })
  );
}
</file>

<file path="src/tools/index.ts">
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { searchShopifyAdminSchema } from "./shopify-admin-schema.js";

const SHOPIFY_BASE_URL = "https://shopify.dev";

/**
 * Searches Shopify documentation with the given query
 * @param prompt The search query for Shopify documentation
 * @returns The formatted response or error message
 */
export async function searchShopifyDocs(prompt: string) {
  try {
    // Prepare the URL with query parameters
    const url = new URL("/mcp/search", SHOPIFY_BASE_URL);
    url.searchParams.append("query", prompt);

    console.error(`[shopify-docs] Making GET request to: ${url.toString()}`);

    // Make the GET request
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
        "X-Shopify-Surface": "mcp",
      },
    });

    console.error(
      `[shopify-docs] Response status: ${response.status} ${response.statusText}`
    );

    // Convert headers to object for logging
    const headersObj: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headersObj[key] = value;
    });
    console.error(
      `[shopify-docs] Response headers: ${JSON.stringify(headersObj)}`
    );

    if (!response.ok) {
      console.error(`[shopify-docs] HTTP error status: ${response.status}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Read and process the response
    const responseText = await response.text();
    console.error(
      `[shopify-docs] Response text (truncated): ${
        responseText.substring(0, 200) +
        (responseText.length > 200 ? "..." : "")
      }`
    );

    // Parse and format the JSON for human readability
    try {
      const jsonData = JSON.parse(responseText);
      const formattedJson = JSON.stringify(jsonData, null, 2);

      return {
        success: true,
        formattedText: formattedJson,
      };
    } catch (e) {
      console.warn(`[shopify-docs] Error parsing JSON response: ${e}`);
      // If parsing fails, return the raw text
      return {
        success: true,
        formattedText: responseText,
      };
    }
  } catch (error) {
    console.error(
      `[shopify-docs] Error searching Shopify documentation: ${error}`
    );

    return {
      success: false,
      formattedText: `Error searching Shopify documentation: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function shopifyTools(server: McpServer) {
  server.tool(
    "introspect_admin_schema",
    `This tool introspects and returns the portion of the Shopify Admin API GraphQL schema relevant to the user prompt. Only use this for the Shopify Admin API, and not any other APIs like the Shopify Storefront API or the Shopify Functions API.

    It takes two arguments: query and filter. The query argument is the string search term to filter schema elements by name. The filter argument is an array of strings to filter results to show specific sections.`,
    {
      query: z
        .string()
        .describe(
          "Search term to filter schema elements by name. Only pass simple terms like 'product', 'discountProduct', etc."
        ),
      filter: z
        .array(z.enum(["all", "types", "queries", "mutations"]))
        .optional()
        .default(["all"])
        .describe(
          "Filter results to show specific sections. Can include 'types', 'queries', 'mutations', or 'all' (default)"
        ),
    },
    async ({ query, filter }, extra) => {
      const result = await searchShopifyAdminSchema(query, { filter });

      if (result.success) {
        return {
          content: [
            {
              type: "text" as const,
              text: result.responseText,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error processing Shopify Admin GraphQL schema: ${result.error}. Make sure the schema file exists.`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "search_dev_docs",
    `This tool will take in the user prompt, search shopify.dev, and return relevant documentation that will help answer the user's question.

    It takes one argument: prompt, which is the search query for Shopify documentation.`,
    {
      prompt: z.string().describe("The search query for Shopify documentation"),
    },
    async ({ prompt }, extra) => {
      const result = await searchShopifyDocs(prompt);

      return {
        content: [
          {
            type: "text" as const,
            text: result.formattedText,
          },
        ],
      };
    }
  );
}
</file>

<file path="src/tools/shopify-admin-schema.test.ts">
// Import vitest first
import { describe, test, expect, beforeEach, vi, afterAll } from "vitest";
import { vol } from "memfs";

vi.mock("node:fs");
vi.mock("node:fs/promises");

// Now import the module to test
import {
  formatType,
  formatArg,
  formatField,
  formatSchemaType,
  formatGraphqlOperation,
  searchShopifyAdminSchema,
  filterAndSortItems,
  MAX_FIELDS_TO_SHOW,
} from "./shopify-admin-schema.js";

// Mock console.error
const originalConsoleError = console.error;
console.error = vi.fn();

// Clean up after tests
afterAll(() => {
  console.error = originalConsoleError;
});

describe("formatType", () => {
  test("formats scalar types", () => {
    const type = { kind: "SCALAR", name: "String", ofType: null };
    expect(formatType(type)).toBe("String");
  });

  test("formats non-null types", () => {
    const type = {
      kind: "NON_NULL",
      name: null,
      ofType: { kind: "SCALAR", name: "String", ofType: null },
    };
    expect(formatType(type)).toBe("String!");
  });

  test("formats list types", () => {
    const type = {
      kind: "LIST",
      name: null,
      ofType: { kind: "SCALAR", name: "String", ofType: null },
    };
    expect(formatType(type)).toBe("[String]");
  });

  test("formats complex nested types", () => {
    const type = {
      kind: "NON_NULL",
      name: null,
      ofType: {
        kind: "LIST",
        name: null,
        ofType: {
          kind: "NON_NULL",
          name: null,
          ofType: { kind: "OBJECT", name: "Product", ofType: null },
        },
      },
    };
    expect(formatType(type)).toBe("[Product!]!");
  });

  test("handles null input", () => {
    expect(formatType(null)).toBe("null");
  });
});

describe("formatArg", () => {
  test("formats basic argument", () => {
    const arg = {
      name: "id",
      type: { kind: "SCALAR", name: "ID", ofType: null },
      defaultValue: null,
    };
    expect(formatArg(arg)).toBe("id: ID");
  });

  test("formats argument with default value", () => {
    const arg = {
      name: "first",
      type: { kind: "SCALAR", name: "Int", ofType: null },
      defaultValue: "10",
    };
    expect(formatArg(arg)).toBe("first: Int = 10");
  });

  test("formats argument with complex type", () => {
    const arg = {
      name: "input",
      type: {
        kind: "NON_NULL",
        name: null,
        ofType: { kind: "INPUT_OBJECT", name: "ProductInput", ofType: null },
      },
      defaultValue: null,
    };
    expect(formatArg(arg)).toBe("input: ProductInput!");
  });
});

describe("formatField", () => {
  test("formats basic field", () => {
    const field = {
      name: "id",
      args: [],
      type: { kind: "SCALAR", name: "ID", ofType: null },
      isDeprecated: false,
      deprecationReason: null,
    };
    expect(formatField(field)).toBe("  id: ID");
  });

  test("formats field with arguments", () => {
    const field = {
      name: "product",
      args: [
        {
          name: "id",
          type: { kind: "SCALAR", name: "ID", ofType: null },
          defaultValue: null,
        },
      ],
      type: { kind: "OBJECT", name: "Product", ofType: null },
      isDeprecated: false,
      deprecationReason: null,
    };
    expect(formatField(field)).toBe("  product(id: ID): Product");
  });

  test("formats deprecated field", () => {
    const field = {
      name: "legacyField",
      args: [],
      type: { kind: "SCALAR", name: "String", ofType: null },
      isDeprecated: true,
      deprecationReason: "Use newField instead",
    };
    expect(formatField(field)).toBe(
      "  legacyField: String @deprecated (Use newField instead)"
    );
  });
});

describe("formatSchemaType", () => {
  test("formats object type with fields", () => {
    const type = {
      kind: "OBJECT",
      name: "Product",
      description: "A product in the shop",
      interfaces: [{ name: "Node" }],
      fields: [
        {
          name: "id",
          args: [],
          type: { kind: "SCALAR", name: "ID", ofType: null },
          isDeprecated: false,
          deprecationReason: null,
        },
        {
          name: "title",
          args: [],
          type: { kind: "SCALAR", name: "String", ofType: null },
          isDeprecated: false,
          deprecationReason: null,
        },
      ],
      inputFields: null,
    };

    const result = formatSchemaType(type);
    expect(result).toContain("OBJECT Product");
    expect(result).toContain("Description: A product in the shop");
    expect(result).toContain("Implements: Node");
    expect(result).toContain("Fields:");
    expect(result).toContain("id: ID");
    expect(result).toContain("title: String");
  });

  test("formats input object type with input fields", () => {
    const type = {
      kind: "INPUT_OBJECT",
      name: "ProductInput",
      description: "Input for creating a product",
      interfaces: [],
      fields: null,
      inputFields: [
        {
          name: "title",
          type: { kind: "SCALAR", name: "String", ofType: null },
          defaultValue: null,
        },
        {
          name: "price",
          type: { kind: "SCALAR", name: "Float", ofType: null },
          defaultValue: null,
        },
      ],
    };

    const result = formatSchemaType(type);
    expect(result).toContain("INPUT_OBJECT ProductInput");
    expect(result).toContain("Description: Input for creating a product");
    expect(result).toContain("Input Fields:");
    expect(result).toContain("title: String");
    expect(result).toContain("price: Float");
  });

  test("handles type with many fields by truncating", () => {
    // Create an object with more than MAX_FIELDS_TO_SHOW fields
    const manyFields = Array(MAX_FIELDS_TO_SHOW + 10)
      .fill(null)
      .map((_, i) => ({
        name: `field${i}`,
        args: [],
        type: { kind: "SCALAR", name: "String", ofType: null },
        isDeprecated: false,
        deprecationReason: null,
      }));

    const type = {
      kind: "OBJECT",
      name: "LargeType",
      description: "Type with many fields",
      interfaces: [],
      fields: manyFields,
      inputFields: null,
    };

    const result = formatSchemaType(type);
    expect(result).toContain(`... and 10 more fields`);
    // Should include MAX_FIELDS_TO_SHOW fields
    expect((result.match(/field\d+: String/g) || []).length).toBe(
      MAX_FIELDS_TO_SHOW
    );
  });

  test("handles type with many input fields by truncating", () => {
    // Create an input object with more than MAX_FIELDS_TO_SHOW fields
    const manyInputFields = Array(MAX_FIELDS_TO_SHOW + 10)
      .fill(null)
      .map((_, i) => ({
        name: `inputField${i}`,
        type: { kind: "SCALAR", name: "String", ofType: null },
        defaultValue: null,
      }));

    const type = {
      kind: "INPUT_OBJECT",
      name: "LargeInputType",
      description: "Input type with many fields",
      interfaces: [],
      fields: null,
      inputFields: manyInputFields,
    };

    const result = formatSchemaType(type);
    expect(result).toContain(`... and 10 more input fields`);
    // Should include MAX_FIELDS_TO_SHOW fields
    expect((result.match(/inputField\d+: String/g) || []).length).toBe(
      MAX_FIELDS_TO_SHOW
    );
  });
});

describe("formatGraphqlOperation", () => {
  test("formats query with arguments and return type", () => {
    const query = {
      name: "product",
      description: "Get a product by ID",
      args: [
        {
          name: "id",
          type: {
            kind: "NON_NULL",
            name: null,
            ofType: { kind: "SCALAR", name: "ID", ofType: null },
          },
          defaultValue: null,
        },
      ],
      type: { kind: "OBJECT", name: "Product", ofType: null },
    };

    const result = formatGraphqlOperation(query);
    expect(result).toContain("product");
    expect(result).toContain("Description: Get a product by ID");
    expect(result).toContain("Arguments:");
    expect(result).toContain("id: ID!");
    expect(result).toContain("Returns: Product");
  });

  test("truncates long descriptions", () => {
    const longDescription =
      "This is a very long description that should be truncated. ".repeat(10);
    const query = {
      name: "longQuery",
      description: longDescription,
      args: [],
      type: { kind: "SCALAR", name: "String", ofType: null },
    };

    const result = formatGraphqlOperation(query);
    expect(result).toContain("...");
    expect(result.length).toBeLessThan(longDescription.length);
  });
});

describe("filterAndSortItems", () => {
  test("filters items by name matching search term", () => {
    const items = [
      { name: "Product" },
      { name: "ProductInput" },
      { name: "Order" },
      { name: "OrderInput" },
      { name: "ProductVariant" },
    ];

    const result = filterAndSortItems(items, "product", 10);
    expect(result.items.length).toBe(3);
    expect(result.items[0].name).toBe("Product");
    expect(result.items[1].name).toBe("ProductInput");
    expect(result.items[2].name).toBe("ProductVariant");
    expect(result.wasTruncated).toBe(false);
  });

  test("sorts items by name length", () => {
    const items = [
      { name: "ProductVariant" },
      { name: "ProductInput" },
      { name: "Product" },
    ];

    const result = filterAndSortItems(items, "product", 10);
    expect(result.items[0].name).toBe("Product"); // Shortest first
    expect(result.items[1].name).toBe("ProductInput");
    expect(result.items[2].name).toBe("ProductVariant");
  });

  test("truncates results to maxItems", () => {
    const items = Array(20)
      .fill(null)
      .map((_, i) => ({ name: `Product${i}` }));

    const result = filterAndSortItems(items, "product", 5);
    expect(result.items.length).toBe(5);
    expect(result.wasTruncated).toBe(true);
  });

  test("handles items without names", () => {
    const items = [
      { name: "Product" },
      { somethingElse: true },
      { name: null },
      { name: "AnotherProduct" },
    ];

    const result = filterAndSortItems(items, "product", 10);
    expect(result.items.length).toBe(2);
  });
});

describe("searchShopifyAdminSchema", () => {
  // Sample schema for testing
  const sampleSchema = {
    data: {
      __schema: {
        types: [
          {
            kind: "OBJECT",
            name: "Product",
            description: "A product in the shop",
            fields: [
              {
                name: "id",
                args: [],
                type: { kind: "SCALAR", name: "ID", ofType: null },
                isDeprecated: false,
              },
              {
                name: "title",
                args: [],
                type: { kind: "SCALAR", name: "String", ofType: null },
                isDeprecated: false,
              },
            ],
          },
          {
            kind: "INPUT_OBJECT",
            name: "ProductInput",
            description: "Input for a product",
            fields: null,
            inputFields: [
              {
                name: "title",
                type: { kind: "SCALAR", name: "String", ofType: null },
                defaultValue: null,
              },
            ],
          },
          {
            kind: "OBJECT",
            name: "Order",
            description: "An order in the shop",
            fields: [
              {
                name: "id",
                args: [],
                type: { kind: "SCALAR", name: "ID", ofType: null },
                isDeprecated: false,
              },
            ],
          },
          {
            kind: "OBJECT",
            name: "QueryRoot",
            fields: [
              {
                name: "product",
                description: "Get a product by ID",
                args: [
                  {
                    name: "id",
                    type: { kind: "SCALAR", name: "ID", ofType: null },
                    defaultValue: null,
                  },
                ],
                type: { kind: "OBJECT", name: "Product", ofType: null },
              },
              {
                name: "order",
                description: "Get an order by ID",
                args: [
                  {
                    name: "id",
                    type: { kind: "SCALAR", name: "ID", ofType: null },
                    defaultValue: null,
                  },
                ],
                type: { kind: "OBJECT", name: "Order", ofType: null },
              },
            ],
          },
          {
            kind: "OBJECT",
            name: "Mutation",
            fields: [
              {
                name: "productCreate",
                description: "Create a product",
                args: [
                  {
                    name: "input",
                    type: {
                      kind: "INPUT_OBJECT",
                      name: "ProductInput",
                      ofType: null,
                    },
                    defaultValue: null,
                  },
                ],
                type: { kind: "OBJECT", name: "Product", ofType: null },
              },
            ],
          },
        ],
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vol.reset();
    vol.fromJSON({
      "./data/admin_schema_2025-01.json": JSON.stringify(sampleSchema),
    });
  });

  test("returns formatted results for a search query", async () => {
    const result = await searchShopifyAdminSchema("product");

    expect(result.success).toBe(true);
    expect(result.responseText).toContain("## Matching GraphQL Types:");
    expect(result.responseText).toContain("OBJECT Product");
    expect(result.responseText).toContain("INPUT_OBJECT ProductInput");
    expect(result.responseText).toContain("## Matching GraphQL Queries:");
    expect(result.responseText).toContain("product");
    expect(result.responseText).toContain("## Matching GraphQL Mutations:");
    expect(result.responseText).toContain("productCreate");
  });

  test("normalizes query by removing trailing s", async () => {
    await searchShopifyAdminSchema("products");

    // Check that console.error was called with the normalized search term
    const logCalls = (console.error as any).mock.calls.map(
      (call: any[]) => call[0]
    );
    const hasNormalizedMessage = logCalls.some(
      (msg: any) =>
        typeof msg === "string" &&
        msg.includes("products") &&
        msg.includes("(normalized: product)")
    );
    expect(hasNormalizedMessage).toBe(true);
  });

  test("normalizes query by removing spaces", async () => {
    await searchShopifyAdminSchema("product input");

    // Check that console.error was called with the normalized search term
    const logCalls = (console.error as any).mock.calls.map(
      (call: any[]) => call[0]
    );
    const hasNormalizedMessage = logCalls.some(
      (msg: any) =>
        typeof msg === "string" &&
        msg.includes("product input") &&
        msg.includes("(normalized: productinput)")
    );
    expect(hasNormalizedMessage).toBe(true);
  });

  test("handles empty query", async () => {
    const result = await searchShopifyAdminSchema("");

    expect(result.success).toBe(true);
    // Should not filter the schema
    expect(result.responseText).toContain("OBJECT Product");
    expect(result.responseText).toContain("OBJECT Order");
  });

  test("filters results to show only types", async () => {
    const result = await searchShopifyAdminSchema("product", {
      filter: ["types"],
    });

    expect(result.success).toBe(true);
    // Should include types section
    expect(result.responseText).toContain("## Matching GraphQL Types:");
    expect(result.responseText).toContain("OBJECT Product");
    expect(result.responseText).toContain("INPUT_OBJECT ProductInput");
    // Should not include other sections
    expect(result.responseText).not.toContain("## Matching GraphQL Queries:");
    expect(result.responseText).not.toContain("## Matching GraphQL Mutations:");
  });

  test("filters results to show only queries", async () => {
    const result = await searchShopifyAdminSchema("product", {
      filter: ["queries"],
    });

    expect(result.success).toBe(true);
    // Should not include types section
    expect(result.responseText).not.toContain("## Matching GraphQL Types:");
    // Should include queries section
    expect(result.responseText).toContain("## Matching GraphQL Queries:");
    expect(result.responseText).toContain("product");
    // Should not include mutations section
    expect(result.responseText).not.toContain("## Matching GraphQL Mutations:");
    expect(result.responseText).not.toContain("productCreate");
  });

  test("filters results to show only mutations", async () => {
    const result = await searchShopifyAdminSchema("product", {
      filter: ["mutations"],
    });

    expect(result.success).toBe(true);
    // Should not include types section
    expect(result.responseText).not.toContain("## Matching GraphQL Types:");
    // Should not include queries section
    expect(result.responseText).not.toContain("## Matching GraphQL Queries:");
    // Should include mutations section
    expect(result.responseText).toContain("## Matching GraphQL Mutations:");
    expect(result.responseText).toContain("productCreate");
  });

  test("shows all sections when operationType is 'all'", async () => {
    const result = await searchShopifyAdminSchema("product", {
      filter: ["all"],
    });

    expect(result.success).toBe(true);
    // Should include all sections
    expect(result.responseText).toContain("## Matching GraphQL Types:");
    expect(result.responseText).toContain("OBJECT Product");
    expect(result.responseText).toContain("INPUT_OBJECT ProductInput");
    expect(result.responseText).toContain("## Matching GraphQL Queries:");
    expect(result.responseText).toContain("product");
    expect(result.responseText).toContain("## Matching GraphQL Mutations:");
    expect(result.responseText).toContain("productCreate");
  });

  test("defaults to showing all sections when filter is not provided", async () => {
    const result = await searchShopifyAdminSchema("product");

    expect(result.success).toBe(true);
    // Should include all sections
    expect(result.responseText).toContain("## Matching GraphQL Types:");
    expect(result.responseText).toContain("OBJECT Product");
    expect(result.responseText).toContain("INPUT_OBJECT ProductInput");
    expect(result.responseText).toContain("## Matching GraphQL Queries:");
    expect(result.responseText).toContain("product");
    expect(result.responseText).toContain("## Matching GraphQL Mutations:");
    expect(result.responseText).toContain("productCreate");
  });

  test("can show multiple sections with array of filters", async () => {
    const result = await searchShopifyAdminSchema("product", {
      filter: ["queries", "mutations"],
    });

    expect(result.success).toBe(true);
    // Should not include types section
    expect(result.responseText).not.toContain("## Matching GraphQL Types:");
    // Should include queries section
    expect(result.responseText).toContain("## Matching GraphQL Queries:");
    expect(result.responseText).toContain("product");
    // Should include mutations section
    expect(result.responseText).toContain("## Matching GraphQL Mutations:");
    expect(result.responseText).toContain("productCreate");
  });
});
</file>

<file path="src/tools/shopify-admin-schema.ts">
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import zlib from "zlib";
import { existsSync } from "fs";

// Get the directory name for the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the schema file in the data folder
export const SCHEMA_FILE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "data",
  "admin_schema_2025-01.json"
);

// Function to load schema content, handling decompression if needed
export async function loadSchemaContent(schemaPath: string): Promise<string> {
  const gzippedSchemaPath = `${schemaPath}.gz`;

  // If uncompressed file doesn't exist but gzipped does, decompress it
  if (!existsSync(schemaPath) && existsSync(gzippedSchemaPath)) {
    console.error(
      `[shopify-admin-schema-tool] Decompressing GraphQL schema from ${gzippedSchemaPath}`
    );
    const compressedData = await fs.readFile(gzippedSchemaPath);
    const schemaContent = zlib.gunzipSync(compressedData).toString("utf-8");

    // Save the uncompressed content to disk
    await fs.writeFile(schemaPath, schemaContent, "utf-8");
    console.error(
      `[shopify-admin-schema-tool] Saved uncompressed schema to ${schemaPath}`
    );
    return schemaContent;
  }

  console.error(
    `[shopify-admin-schema-tool] Reading GraphQL schema from ${schemaPath}`
  );
  return fs.readFile(schemaPath, "utf8");
}

// Maximum number of fields to extract from an object
export const MAX_FIELDS_TO_SHOW = 50;

// Helper function to filter, sort, and truncate schema items
export const filterAndSortItems = (
  items: any[],
  searchTerm: string,
  maxItems: number
) => {
  // Filter items based on search term
  const filtered = items.filter((item: any) =>
    item.name?.toLowerCase().includes(searchTerm)
  );

  // Sort filtered items by name length (shorter names first)
  filtered.sort((a: any, b: any) => {
    if (!a.name) return 1;
    if (!b.name) return -1;
    return a.name.length - b.name.length;
  });

  // Return truncation info and limited items
  return {
    wasTruncated: filtered.length > maxItems,
    items: filtered.slice(0, maxItems),
  };
};

// Helper functions to format GraphQL schema types as plain text
export const formatType = (type: any): string => {
  if (!type) return "null";

  if (type.kind === "NON_NULL") {
    return `${formatType(type.ofType)}!`;
  } else if (type.kind === "LIST") {
    return `[${formatType(type.ofType)}]`;
  } else {
    return type.name;
  }
};

export const formatArg = (arg: any): string => {
  return `${arg.name}: ${formatType(arg.type)}${
    arg.defaultValue !== null ? ` = ${arg.defaultValue}` : ""
  }`;
};

export const formatField = (field: any): string => {
  let result = `  ${field.name}`;

  // Add arguments if present
  if (field.args && field.args.length > 0) {
    result += `(${field.args.map(formatArg).join(", ")})`;
  }

  result += `: ${formatType(field.type)}`;

  // Add deprecation info if present
  if (field.isDeprecated) {
    result += ` @deprecated`;
    if (field.deprecationReason) {
      result += ` (${field.deprecationReason})`;
    }
  }

  return result;
};

export const formatSchemaType = (item: any): string => {
  let result = `${item.kind} ${item.name}`;

  if (item.description) {
    // Truncate description if too long
    const maxDescLength = 150;
    const desc = item.description.replace(/\n/g, " ");
    result += `\n  Description: ${
      desc.length > maxDescLength
        ? desc.substring(0, maxDescLength) + "..."
        : desc
    }`;
  }

  // Add interfaces if present
  if (item.interfaces && item.interfaces.length > 0) {
    result += `\n  Implements: ${item.interfaces
      .map((i: any) => i.name)
      .join(", ")}`;
  }

  // For INPUT_OBJECT types, use inputFields instead of fields
  if (
    item.kind === "INPUT_OBJECT" &&
    item.inputFields &&
    item.inputFields.length > 0
  ) {
    result += "\n  Input Fields:";
    // Extract at most MAX_FIELDS_TO_SHOW fields
    const fieldsToShow = item.inputFields.slice(0, MAX_FIELDS_TO_SHOW);
    for (const field of fieldsToShow) {
      result += `\n${formatField(field)}`;
    }
    if (item.inputFields.length > MAX_FIELDS_TO_SHOW) {
      result += `\n  ... and ${
        item.inputFields.length - MAX_FIELDS_TO_SHOW
      } more input fields`;
    }
  }
  // For regular object types, use fields
  else if (item.fields && item.fields.length > 0) {
    result += "\n  Fields:";
    // Extract at most MAX_FIELDS_TO_SHOW fields
    const fieldsToShow = item.fields.slice(0, MAX_FIELDS_TO_SHOW);
    for (const field of fieldsToShow) {
      result += `\n${formatField(field)}`;
    }
    if (item.fields.length > MAX_FIELDS_TO_SHOW) {
      result += `\n  ... and ${
        item.fields.length - MAX_FIELDS_TO_SHOW
      } more fields`;
    }
  }

  return result;
};

export const formatGraphqlOperation = (query: any): string => {
  let result = `${query.name}`;

  if (query.description) {
    // Truncate description if too long
    const maxDescLength = 100;
    const desc = query.description.replace(/\n/g, " ");
    result += `\n  Description: ${
      desc.length > maxDescLength
        ? desc.substring(0, maxDescLength) + "..."
        : desc
    }`;
  }

  // Add arguments if present
  if (query.args && query.args.length > 0) {
    result += "\n  Arguments:";
    for (const arg of query.args) {
      result += `\n    ${formatArg(arg)}`;
    }
  }

  // Add return type
  result += `\n  Returns: ${formatType(query.type)}`;

  return result;
};

// Function to search and format schema data
export async function searchShopifyAdminSchema(
  query: string,
  {
    filter = ["all"],
  }: { filter?: Array<"all" | "types" | "queries" | "mutations"> } = {}
) {
  try {
    const schemaContent = await loadSchemaContent(SCHEMA_FILE_PATH);

    // Parse the schema content
    const schemaJson = JSON.parse(schemaContent);

    // If a query is provided, filter the schema
    let resultSchema = schemaJson;
    let wasTruncated = false;
    let queriesWereTruncated = false;
    let mutationsWereTruncated = false;

    if (query && query.trim()) {
      // Normalize search term: remove trailing 's' and remove all spaces
      let normalizedQuery = query.trim();
      if (normalizedQuery.endsWith("s")) {
        normalizedQuery = normalizedQuery.slice(0, -1);
      }
      normalizedQuery = normalizedQuery.replace(/\s+/g, "");

      console.error(
        `[shopify-admin-schema-tool] Filtering schema with query: ${query} (normalized: ${normalizedQuery})`
      );

      const searchTerm = normalizedQuery.toLowerCase();

      // Example filtering logic (adjust based on actual schema structure)
      if (schemaJson?.data?.__schema?.types) {
        const MAX_RESULTS = 10;

        // Process types
        const processedTypes = filterAndSortItems(
          schemaJson.data.__schema.types,
          searchTerm,
          MAX_RESULTS
        );
        wasTruncated = processedTypes.wasTruncated;
        const limitedTypes = processedTypes.items;

        // Find the Query and Mutation types
        const queryType = schemaJson.data.__schema.types.find(
          (type: any) => type.name === "QueryRoot"
        );
        const mutationType = schemaJson.data.__schema.types.find(
          (type: any) => type.name === "Mutation"
        );

        // Process queries if available
        let matchingQueries: any[] = [];
        if (
          queryType &&
          queryType.fields &&
          (filter.includes("all") || filter.includes("queries"))
        ) {
          const processedQueries = filterAndSortItems(
            queryType.fields,
            searchTerm,
            MAX_RESULTS
          );
          queriesWereTruncated = processedQueries.wasTruncated;
          matchingQueries = processedQueries.items;
        }

        // Process mutations if available
        let matchingMutations: any[] = [];
        if (
          mutationType &&
          mutationType.fields &&
          (filter.includes("all") || filter.includes("mutations"))
        ) {
          const processedMutations = filterAndSortItems(
            mutationType.fields,
            searchTerm,
            MAX_RESULTS
          );
          mutationsWereTruncated = processedMutations.wasTruncated;
          matchingMutations = processedMutations.items;
        }

        // Create a modified schema that includes matching types
        resultSchema = {
          data: {
            __schema: {
              ...schemaJson.data.__schema,
              types: limitedTypes,
              matchingQueries,
              matchingMutations,
            },
          },
        };
      }
    }

    // Create the response text with truncation message if needed
    let responseText = "";

    if (filter.includes("all") || filter.includes("types")) {
      responseText += "## Matching GraphQL Types:\n";
      if (wasTruncated) {
        responseText += `(Results limited to 10 items. Refine your search for more specific results.)\n\n`;
      }

      if (resultSchema.data.__schema.types.length > 0) {
        responseText +=
          resultSchema.data.__schema.types.map(formatSchemaType).join("\n\n") +
          "\n\n";
      } else {
        responseText += "No matching types found.\n\n";
      }
    }

    // Add queries section if showing all or queries
    if (filter.includes("all") || filter.includes("queries")) {
      responseText += "## Matching GraphQL Queries:\n";
      if (queriesWereTruncated) {
        responseText += `(Results limited to 10 items. Refine your search for more specific results.)\n\n`;
      }

      if (resultSchema.data.__schema.matchingQueries?.length > 0) {
        responseText +=
          resultSchema.data.__schema.matchingQueries
            .map(formatGraphqlOperation)
            .join("\n\n") + "\n\n";
      } else {
        responseText += "No matching queries found.\n\n";
      }
    }

    // Add mutations section if showing all or mutations
    if (filter.includes("all") || filter.includes("mutations")) {
      responseText += "## Matching GraphQL Mutations:\n";
      if (mutationsWereTruncated) {
        responseText += `(Results limited to 10 items. Refine your search for more specific results.)\n\n`;
      }

      if (resultSchema.data.__schema.matchingMutations?.length > 0) {
        responseText += resultSchema.data.__schema.matchingMutations
          .map(formatGraphqlOperation)
          .join("\n\n");
      } else {
        responseText += "No matching mutations found.";
      }
    }

    return { success: true as const, responseText };
  } catch (error) {
    console.error(
      `[shopify-admin-schema-tool] Error processing GraphQL schema: ${error}`
    );
    return {
      success: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
</file>

<file path="src/tools/shopify.test.ts">
// Import vitest first
import { describe, test, expect, beforeEach, vi, afterAll } from "vitest";

// Mock fetch globally
global.fetch = vi.fn();

// Now import the modules to test
import { searchShopifyDocs } from "./index.js";

// Mock console.error and console.warn
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
console.error = vi.fn();
console.warn = vi.fn();

// Clean up after tests
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Sample response data for mocking
const sampleDocsResponse = [
  {
    filename: "api/admin/graphql/reference/products.md",
    score: 0.85,
    content:
      "The products API allows you to manage products in your Shopify store.",
  },
  {
    filename: "apps/tools/product-listings.md",
    score: 0.72,
    content:
      "Learn how to display and manage product listings in your Shopify app.",
  },
];

describe("searchShopifyDocs", () => {
  let fetchMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup the mock for fetch
    fetchMock = global.fetch as any;

    // By default, mock successful response
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        forEach: (callback: (value: string, key: string) => void) => {
          callback("application/json", "content-type");
        },
      },
      text: async () => JSON.stringify(sampleDocsResponse),
    });
  });

  test("returns formatted JSON response correctly", async () => {
    // Call the function directly with test parameters
    const result = await searchShopifyDocs("product listings");

    // Verify the fetch was called with correct URL
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchUrl = fetchMock.mock.calls[0][0];
    expect(fetchUrl).toContain("/mcp/search");
    expect(fetchUrl).toContain("query=product+listings");

    // Check that the response is formatted JSON
    expect(result.success).toBe(true);

    // The response should be properly formatted with indentation
    expect(result.formattedText).toContain("{\n");
    expect(result.formattedText).toContain('  "filename":');

    // Parse the response and verify it matches our sample data
    const parsedResponse = JSON.parse(result.formattedText);
    expect(parsedResponse).toEqual(sampleDocsResponse);
    expect(parsedResponse[0].filename).toBe(
      "api/admin/graphql/reference/products.md"
    );
    expect(parsedResponse[0].score).toBe(0.85);
  });

  test("handles HTTP error", async () => {
    // Mock an error response
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: {
        forEach: (callback: (value: string, key: string) => void) => {
          callback("text/plain", "content-type");
        },
      },
    });

    // Call the function directly
    const result = await searchShopifyDocs("product");

    // Check that the error was handled
    expect(result.success).toBe(false);
    expect(result.formattedText).toContain(
      "Error searching Shopify documentation"
    );
    expect(result.formattedText).toContain("500");
  });

  test("handles fetch error", async () => {
    // Mock a network error
    fetchMock.mockRejectedValue(new Error("Network error"));

    // Call the function directly
    const result = await searchShopifyDocs("product");

    // Check that the error was handled
    expect(result.success).toBe(false);
    expect(result.formattedText).toContain(
      "Error searching Shopify documentation: Network error"
    );
  });

  test("handles non-JSON response gracefully", async () => {
    // Mock a non-JSON response
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        forEach: (callback: (value: string, key: string) => void) => {
          callback("text/plain", "content-type");
        },
      },
      text: async () => "This is not valid JSON",
    });

    // Clear the mocks before the test
    vi.mocked(console.warn).mockClear();

    // Call the function directly
    const result = await searchShopifyDocs("product");

    // Check that the error was handled and raw text is returned
    expect(result.success).toBe(true);
    expect(result.formattedText).toBe("This is not valid JSON");

    // Verify that console.warn was called with the JSON parsing error
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0][0]).toContain(
      "Error parsing JSON response"
    );
  });
});
</file>

<file path="src/index.ts">
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { shopifyTools } from "./tools/index.js";
import { shopifyPrompts } from "./prompts/index.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf8")
);
const VERSION = packageJson.version;

async function main() {
  // Create server instance
  const server = new McpServer(
    {
      name: "shopify-dev-mcp",
      version: VERSION,
    },
    {
      capabilities: {
        logging: {},
      },
    }
  );

  // Register Shopify tools
  shopifyTools(server);

  // Register Shopify prompts
  shopifyPrompts(server);

  // Connect to transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Shopify Dev MCP Server v${VERSION} running on stdio`);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
</file>

<file path=".gitignore">
node_modules/
dist/
data/**/*.json
.DS_Store
</file>

<file path="CODE_OF_CONDUCT.md">
# Contributor Code of Conduct

As contributors and maintainers of this project, and in the interest of
fostering an open and welcoming community, we pledge to respect all
people who contribute through reporting issues, posting feature
requests, updating documentation, submitting pull requests or patches,
and other activities.

We are committed to making participation in this project a
harassment-free experience for everyone, regardless of level of
experience, gender, gender identity and expression, sexual orientation,
disability, personal appearance, body size, race, ethnicity, age,
religion, or nationality.

Examples of unacceptable behavior by participants include:

- The use of sexualized language or imagery
- Personal attacks
- Trolling or insulting/derogatory comments
- Public or private harassment
- Publishing other's private information, such as physical or electronic
  addresses, without explicit permission
- Other unethical or unprofessional conduct

Project maintainers have the right and responsibility to remove, edit,
or reject comments, commits, code, wiki edits, issues, and other
contributions that are not aligned to this Code of Conduct, or to ban
temporarily or permanently any contributor for other behaviors that they
deem inappropriate, threatening, offensive, or harmful.

By adopting this Code of Conduct, project maintainers commit themselves
to fairly and consistently applying these principles to every aspect of
managing this project. Project maintainers who do not follow or enforce
the Code of Conduct may be permanently removed from the project team.

This Code of Conduct applies both within project spaces and in public
spaces when an individual is representing the project or its community.

Instances of abusive, harassing, or otherwise unacceptable behavior may
be reported by contacting a project maintainer at <opensource@shopify.com>.
All complaints will be reviewed and investigated and will result in a response
that is deemed necessary and appropriate to the circumstances. Maintainers are
obligated to maintain confidentiality with regard to the reporter of an incident.

This Code of Conduct is adapted from the Contributor Covenant, version
1.3.0, available from http://contributor-covenant.org/version/1/3/0/
</file>

<file path="CONTRIBUTING.md">
# Contributing

We welcome your contributions to the project. There are a few steps to take when looking to make a contribution.

- Open an issue to discuss the feature/bug
- If feature/bug is deemed valid then fork repo.
- Implement patch to resolve issue.
- Include tests to prevent regressions and validate the patch.
- Update the docs for any API changes.
- Submit a pull request.

> [!NOTE]
> If you're contributing changes to optimize or refactor existing code, you must also provide data proving that the changes have a positive performance impact.

## Bug Reporting

Shopify App Express package for Node uses GitHub issue tracking to manage bugs, please open an issue there.

## Feature Request

You can open a new issue on the GitHub issues and describe the feature you would like to see.

## Developing the packages

For instructions on how to set up for developing in this repo, please see the [instructions in the README](./README.md#developing-in-this-repo).
</file>

<file path="LICENSE">
ISC License

Copyright 2025-present, Shopify Inc.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
</file>

<file path="package.json">
{
  "name": "@shopify/dev-mcp",
  "version": "1.0.2",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc && node -e \"require('fs').chmodSync('dist/index.js', '755')\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "inspector": "npm run build && npm exec @modelcontextprotocol/inspector dist/index.js"
  },
  "author": "",
  "license": "ISC",
  "description": "A command line tool for setting up Shopify Dev MCP server",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.6.1",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@modelcontextprotocol/inspector": "^0.5.1",
    "@types/node": "^22.13.10",
    "@vitest/coverage-v8": "^3.0.9",
    "memfs": "^4.17.0",
    "typescript": "^5.8.2",
    "vitest": "^3.0.9"
  },
  "type": "module",
  "bin": {
    "shopify-dev-mcp": "dist/index.js"
  },
  "files": [
    "dist/**/*.js",
    "!dist/**/*.test.*",
    "data/**/*.json.gz",
    "LICENSE",
    "README.md",
    "package.json"
  ],
  "keywords": [
    "mcp",
    "modelcontextprotocol",
    "shopify"
  ]
}
</file>

<file path="README.md">
# Shopify Dev MCP Server

This project implements a Model Context Protocol (MCP) server that interacts with Shopify Dev. This protocol supports various tools to interact with different Shopify APIs.

## Setup

To run the Shopify MCP server using npx, use the following command:

```bash
npx -y @shopify/dev-mcp@latest
```

## Usage with Cursor or Claude Desktop

Add the following configuration. For more information, read the [Cursor MCP documentation](https://docs.cursor.com/context/model-context-protocol) or the [Claude Desktop MCP guide](https://modelcontextprotocol.io/quickstart/user).

```json
{
  "mcpServers": {
    "shopify-dev-mcp": {
      "command": "npx",
      "args": ["-y", "@shopify/dev-mcp@latest"]
    }
  }
}
```

On Windows, you might need to use this alternative configuration:

```json
{
  "mcpServers": {
    "shopify-dev-mcp": {
      "command": "cmd",
      "args": ["/k", "npx", "-y", "@shopify/dev-mcp@latest"]
    }
  }
}
```

## Available tools

This MCP server provides the following tools:

| Tool Name               | Description                                    |
| ----------------------- | ---------------------------------------------- |
| search_dev_docs         | Search shopify.dev documentation               |
| introspect_admin_schema | Access and search Shopify Admin GraphQL schema |

## Available prompts

This MCP server provides the following prompts:

| Prompt Name           | Description                                                 |
| --------------------- | ----------------------------------------------------------- |
| shopify_admin_graphql | Help you write GraphQL operations for the Shopify Admin API |

## Development

The server is built using the MCP SDK and communicates with Shopify Dev.

1. `npm install`
1. Modify source files
1. Run `npm run build` to compile
1. Run `npm run test` to run tests
1. Add an MCP server that runs this command: `node <absolute_path_of_project>/dist/index.js`

## License

ISC
</file>

<file path="tsconfig.json">
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
</file>

<file path="vitest.config.js">
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
    },
    alias: {
      // Similar to the moduleNameMapper in Jest config
      "^(\\.{1,2}/.*)\\.js$": "$1",
    },
  },
});
</file>

</files>
