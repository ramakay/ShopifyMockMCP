# ShopifyMCPMockShop Implementation Plan

This plan outlines the tasks required to implement the ShopifyMCPMockShop based on `Requirements/Architecture.md`.

**Phase 1: Project Setup & Core Foundation**

1.  **Task: Initialize Project**
    *   Description: Set up a new Next.js project using TypeScript. Initialize Git repository.
    *   Components Involved: Overall Project Structure
    *   Architecture Ref: Section 6 (Vercel/Next.js)
2.  **Task: Vercel Integration Setup**
    *   Description: Configure the project for Vercel deployment. Set up basic environment variable handling (placeholders for now).
    *   Components Involved: Deployment Environment
    *   Architecture Ref: Section 6, Section 4.1
3.  **Task: Implement Configuration Manager**
    *   Description: Create the `ConfigurationManager` module to load, validate, and provide access to environment variables (e.g., `SHOPIFY_STORE`, `SHOPIFY_ACCESS_TOKEN`, `USE_ADMIN_API`, etc.), including default fallbacks (like `mock.shop`).
    *   Components Involved: `Configuration Manager`
    *   Architecture Ref: Section 4.1
4.  **Task: Implement Version Manager (Initial)**
    *   Description: Create the `VersionManager` module. Implement logic to read configured versions. *Defer* the `publicApiVersions` querying logic for now; focus on using configured/default versions.
    *   Components Involved: `Version Manager`
    *   Architecture Ref: Section 4.2 (Steps 1, 5 initially)
5.  **Task: Implement Schema Manager (Basic Structure & Caching)**
    *   Description: Create the `SchemaManager` module. Set up the structure for storing/accessing cached schemas (e.g., reading from placeholder `schema.graphql` / `schema-admin.graphql` files initially). *Defer* the actual introspection logic.
    *   Components Involved: `Schema Manager`
    *   Architecture Ref: Section 4.3 (Focus on providing access to cached schemas)

**Phase 2: Core API Proxies**

6.  **Task: Implement Storefront GraphQL Proxy (`/api/graphql`)**
    *   Description: Create the Vercel Serverless Function. Implement logic to:
        *   Use `ConfigurationManager` to get store details.
        *   Use `VersionManager` to get the target version.
        *   Construct the correct endpoint URL (mock.shop or real store).
        *   Forward requests with appropriate headers (`X-Shopify-Storefront-Access-Token`).
        *   Implement basic error handling/mapping.
    *   Components Involved: `Storefront GraphQL Proxy`, `Configuration Manager`, `Version Manager`
    *   Architecture Ref: Section 4.4
7.  **Task: Implement Admin GraphQL Proxy (`/api/adminGraphql`) (Conditional)**
    *   Description: Create the Vercel Serverless Function. Implement logic to:
        *   Check `ConfigurationManager` if Admin API is enabled/configured; return error if not.
        *   Use `VersionManager` for the Admin API version.
        *   Construct the Admin API endpoint URL.
        *   Forward requests with `X-Shopify-Access-Token`.
        *   Implement stricter security checks and error handling.
    *   Components Involved: `Admin GraphQL Proxy`, `Configuration Manager`, `Version Manager`
    *   Architecture Ref: Section 4.5

**Phase 3: MCP Endpoint & Initial Tools**

8.  **Task: Implement MCP Endpoint (`/api/mcp`) Structure**
    *   Description: Create the Vercel Serverless Function for `/api/mcp`. Set up JSON-RPC request parsing and response formatting.
    *   Components Involved: `MCP Endpoint`
    *   Architecture Ref: Section 4.6
9.  **Task: Implement MCP `initialize` Method**
    *   Description: Implement the logic for the `initialize` MCP method, returning capabilities based on configuration (e.g., conditionally including Admin tools) and resolved versions from `VersionManager`.
    *   Components Involved: `MCP Handler`, `Configuration Manager`, `Version Manager`
    *   Architecture Ref: Section 4.6 (Step 3)
10. **Task: Implement MCP `prompts`, `resources`, `tools` Methods (Basic)**
    *   Description: Implement the basic structure for these methods to load definitions (e.g., from static JSON/TS files initially). Define 1-2 simple example tools/resources. **Ensure the `tools` method includes the `annotations` field (`readonly`, `destructive`, `idempotent`) in the tool definitions.**
    *   Components Involved: `MCP Handler`
    *   Architecture Ref: Section 4.6 (Step 4), Section 7 (Security/Annotations)
11. **Task: Implement MCP Tool Execution Logic (Basic)**
    *   Description: Implement the core logic within the `MCP Handler` to:
        *   Receive a tool execution request.
        *   Determine if Storefront/Admin API is needed based on the specific tool.
        *   **Execute specific server-side logic for the tool**, constructing the necessary GraphQL query/mutation. **(Crucially, do not allow generic execution of client-provided GQL for Admin tools).**
        *   Call the appropriate internal proxy logic (Storefront or Admin).
        *   Format the response.
        *   *Defer schema validation for now.*
    *   Components Involved: `MCP Handler`, `Storefront Logic`, `Admin Logic`
    *   Architecture Ref: Section 4.6 (Step 5)
12. **Task: Implement Initial Core MCP Tools**
    *   Description: Define and implement the initial set of 10 core MCP tools using the Storefront proxy. This involves defining tool specs (arguments, description) and implementing their execution logic within the MCP handler.
        *   `getShopInfo`: Fetch basic shop details.
        *   `getProductById`: Fetch product by ID, optionally including variants/images.
        *   `findProducts`: Search/filter products with pagination/sorting.
        *   `getCollectionById`: Fetch collection by ID, optionally including products.
        *   `findCollections`: Search/filter collections with pagination/sorting.
        *   `cartCreate`: Create a new cart.
        *   `cartLinesAdd`: Add items to a cart.
        *   `cartLinesUpdate`: Update item quantities in a cart.
        *   `cartLinesRemove`: Remove items from a cart.
        *   `getCart`: Fetch cart details by ID.
    *   Components Involved: `MCP Handler`, `Storefront Logic`
    *   Architecture Ref: Section 4.6

12.1. **Task: Implement Initial Admin API MCP Tools**
    *   Description: Define and implement a small, selected set of Admin API tools (e.g., `getCustomerById`, `createProduct`). This involves defining tool specs (arguments, description), **implementing specific execution logic using the Admin proxy**, and **defining their `ToolAnnotations` accurately** (e.g., `readonly`, `destructive`, `idempotent`).
    *   Components Involved: `MCP Handler`, `Admin Logic`
    *   Architecture Ref: Section 4.5, 4.6, Section 7 (Security/Annotations)

**Phase 4: Enhancements & Production Readiness**

13. **Task: Implement `publicApiVersions` Logic in Version Manager**
    *   Description: Enhance `VersionManager` to query Shopify's `publicApiVersions`, validate configured versions, and determine the latest stable version as a fallback. Implement caching.
    *   Components Involved: `Version Manager`
    *   Architecture Ref: Section 4.2 (Steps 2, 3, 4, 6)
14. **Task: Implement Schema Introspection Logic in Schema Manager**
    *   Description: Enhance `SchemaManager` to perform actual GraphQL introspection against the target APIs (Storefront/Admin) based on configuration/version. Implement logic for storing/caching the results (e.g., writing to `.graphql` files). Define trigger conditions (build time, on-demand).
    *   Components Involved: `Schema Manager`, `Configuration Manager`, `Version Manager`
    *   Architecture Ref: Section 4.3
15. **Task: Implement Schema Validation in MCP Tools**
    *   Description: Integrate schema validation (using the cached schemas from `SchemaManager`) into the MCP tool execution flow for inputs/outputs.
    *   Components Involved: `MCP Handler`, `Schema Manager`
    *   Architecture Ref: Section 4.6 (Step 5, validation part)
15.1. **Task: Implement Tool Annotations**
    *   Description: Ensure *all* defined tools (both Storefront and Admin) have their `annotations` field correctly populated and returned by the MCP `tools` method.
    *   Components Involved: `MCP Handler` (Tool Definitions)
    *   Architecture Ref: Section 4.6 (Step 4), Section 7 (Security/Annotations)
16. **Task: Refine Error Handling**
    *   Description: Implement comprehensive and consistent error handling across all API endpoints and MCP methods, including logging and user-friendly error messages.
    *   Components Involved: All API Endpoints, Core Logic
    *   Architecture Ref: Section 8
17. **Task: Security Hardening & Logging**
    *   Description: Implement security best practices (input validation, rate limiting considerations, audit logging for Admin actions) as outlined in the NFRs. **Specifically, consider adding checks or confirmation steps based on tool annotations before executing potentially destructive Admin tools.** Set up structured logging.
    *   Components Involved: All API Endpoints, Core Logic, `MCP Handler`
    *   Architecture Ref: Section 7 (Security), Section 8 (Logging)
18. **Task: Build Process & Deployment**
    *   Description: Finalize Vercel build configurations, including potential build-time schema introspection steps. Ensure smooth deployment.
    *   Components Involved: Deployment Environment
    *   Architecture Ref: Section 6
19. **Task: Testing**
    *   Description: Implement unit and integration tests for core modules and API endpoints.
    *   Components Involved: All