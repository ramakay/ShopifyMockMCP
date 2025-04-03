Revised Technical PRD (with Admin API Context)

Below is an updated Product Requirements Document reflecting the discovery that we can query publicApiVersions from mock.shop (and presumably from real stores), and that an Admin API schema may also be in play.

⸻

1. Overview

We aim to build a “hosted MCP server” on Vercel at ShopifyMCP.vercel.app. This server will provide:
	1.	Shopify Storefront GraphQL proxy – Points to either:
	•	mock.shop if the user hasn’t configured a real store
	•	A real store’s Storefront endpoint if the user supplies credentials
	2.	Optional Shopify Admin GraphQL – If advanced or admin-level operations are needed, we can expose them behind the same or a parallel endpoint. (This is a new consideration, as we now have the admin schema introspection. Handling it is more complex.)
	3.	MCP (Model Context Protocol) interface – A JSON-RPC–based system that allows AI-based IDEs or tools to discover prompts, fetch resources, or call “tools” that tie into the Shopify environment.

We now know that publicApiVersions is a GraphQL field that returns the set of versions, including whether each version is supported or is unstable, and that for admin tasks, the Admin API introspection is significantly different from the Storefront’s. This new info might alter how we handle version selection for real or mock environments.

⸻

2. Goals and Objectives
	1.	Selectable API Versions
	•	Provide an interface (through environment variables or an internal fallback) for choosing which Storefront version to target, or query publicApiVersions to automatically pick the latest stable version.
	2.	Fallback to mock.shop
	•	If the user doesn’t want to risk changes on their real store or hasn’t provided credentials, default to mock.shop’s Storefront API. We can still query publicApiVersions for demonstration, though mock.shop typically defaults to the newest stable.
	3.	MCP Protocol
	•	Support standard JSON-RPC for AI-based or developer clients that want a stable, self-documenting environment.
	•	Potentially unify Storefront (and possibly Admin) tasks behind “tools” or “resources” if advanced functionality is needed.
	4.	Admin API Consideration
	5.	Structured Interaction via MCP Tools
	•	If required, we can incorporate the Admin GraphQL schema. Real admin tasks (like creating products, updating them in bulk, etc.) are only possible with Admin endpoints. This significantly expands scope and security considerations.

⸻

3. Functional Requirements
	1.	MCP
	•	JSON-RPC endpoints supporting initialize, prompts, resources, tools, etc.
	•	AI clients can discover available or custom prompts and safely invoke them.
	•	MCP tools will provide a structured way for clients to perform common, specific Shopify operations (like fetching product details, variants, collections, managing carts) by providing defined arguments. The MCP server is responsible for constructing the necessary GQL query based on these arguments, abstracting GQL complexity from the client.
	•	The initial implementation will focus on a core set of tools covering Shop Info, Product queries, Collection queries, and Cart management (see Section 10).

	2.	Storefront GraphQL
	•	/api/graphql route that queries the Storefront.
	•	Ability to call publicApiVersions if needed, so we can detect the store’s or mock.shop’s available versions. Possibly store or forward that info to clients.
	•	Periodically introspect to keep schema.graphql updated.
	3.	Optional Admin GraphQL
	•	If the user configures separate Admin API credentials, we can provide a second endpoint /api/adminGraphql.
	•	Must be mindful of security and scoping—Admin API keys are typically more privileged.
	•	We can introspect the Admin schema as well and store it as schema-admin.graphql.
	4.	Version Management
	•	If the store has multiple supported versions, we let the user pick an environment variable (e.g., SHOPIFY_VERSION=2025-01).
	•	Our introspection queries publicApiVersions to confirm if that version is supported. If not, fallback to the latest stable.

⸻

4. Non-functional Requirements
	1.	Security
	•	Real Admin API usage can be destructive. Must handle authentication tokens, scoping, logging, and user confirmation.
	•	For mock.shop, no real tokens or data changes occur.
	2.	Scalability & Reliability
	•	Host on Vercel with separate serverless functions:
	•	api/graphql (Storefront, possibly checking SHOPIFY_VERSION)
	•	api/adminGraphql (Admin, optional)
	•	api/mcp (JSON-RPC, bridging with the rest)
	3.	Maintainability
	•	Separate code for Storefront vs. Admin logic.
	•	Keep schema.graphql for Storefront, schema-admin.graphql for Admin.
	•	Possibly unify them in a monorepo or Next.js multi-route structure.
	4.	Performance
	•	Minimally overhead to run introspection. Possibly done at build time plus on demand if stale.
	•	Caching results for a short window.

⸻

5. Architecture (Updated)

flowchart LR
    subgraph "Vercel"
    A[AI Clients / Dev Tools] -- JSON-RPC --> B[MCP Endpoint <br>/api/mcp]
    A -- GraphQL --> C[Storefront Endpoint <br>/api/graphql]
    A -- Possibly Admin GraphQL --> D[Admin Endpoint <br>/api/adminGraphql]
    B --> C
    B --> D
    end

    subgraph "Shopify"
    E[Storefront<br>GraphQL <br>2025-01 or so]
    F[Admin<br>GraphQL]
    end

    C --> E
    D --> F

    subgraph "Build Time"
    G[Introspection Script]
    H[schema.graphql + schema-admin.graphql]
    G --> H
    end

Key Changes:
	•	We can now call publicApiVersions on either store endpoints to see which versions are supported.
	•	We might similarly introspect the Admin schema if we want to handle Admin tasks.

⸻

6. Implementation Steps (Revised)
	1.	Schema Introspection Updates
	•	For Storefront:
	1.	Query publicApiVersions to see available.
	2.	If environment variable SHOPIFY_VERSION is set and is supported, build introspection URL with ?version=.... Otherwise, fallback to the latest stable from publicApiVersions.
	3.	Run standard introspection, store to schema.graphql.
	•	For Admin (Optional):
	1.	If user sets USE_ADMIN_API=1 plus credentials, we introspect with the Admin endpoint.
	2.	Write results to schema-admin.graphql.
	2.	Vercel API Routes
	•	/api/graphql => Storefront proxy. If SHOPIFY_VERSION is set, we route queries to https://<shop>.myshopify.com/api/<SHOPIFY_VERSION>/graphql.json. If empty, default to mock.shop or the latest stable.
	•	/api/adminGraphql => (optional) Admin proxy using the user’s Admin token, if configured.
	•	/api/mcp => JSON-RPC server implementing the MCP. Tools or resources that manipulate store data can call either the storefront or admin route under the hood.
	3.	Capability Declaration
	•	If we do adopt Admin capabilities, we might define them in a separate “tool” category within MCP so the user is aware. E.g., “createProduct” is an Admin tool, “fetchCollections” is a Storefront tool.
	4.	Testing & Deployment
	•	Automated tests verifying that queries run successfully with the chosen version.
	•	Deploy to Vercel and confirm fallback to mock.shop if real credentials are missing.

⸻

7. Impacts on Requirements
	•	We now can detect or choose the Storefront version using publicApiVersions.
	•	The presence of Admin introspection means we can incorporate admin functionalities—but only if the user explicitly wants them. This also expands our scope to handle two different schemas.
	•	Security becomes more critical if we incorporate Admin endpoints.

⸻

8. Example Use Cases (Revisited)
	1.	Version Awareness
	•	Suppose the user sets SHOPIFY_VERSION=2024-10. We run the GetApiVersions query, confirm 2024-10 is supported, introspect that version, and store it in schema.graphql.
	•	If SHOPIFY_VERSION=2025-03 (which might not exist), we fallback to the next stable in the returned list.
	2.	Admin-Level Changes
	•	If the user sets USE_ADMIN_API=1 plus an admin token, we introspect the Admin schema. AI clients can request a defined Admin “tool” like “createProduct” (if implemented), which calls Admin GraphQL behind the scenes.
	•	Without these credentials, that tool is hidden or not available.
	3.	mock.shop
	•	If no real store credentials or version are provided, we route all Storefront queries to mock.shop. The user can still see version info, but it’s mostly for demonstration or dev.
	4.	Client Interaction via MCP Tool
	•	A client wanting the first 3 variants of product "gid://shopify/Product/123" would call the `getProductById` MCP tool with arguments `productId: "gid://shopify/Product/123"`, `includeVariants: true`, `variantCount: 3`. The MCP server handles the GQL construction.

⸻

9. Pros and Cons with the Admin API

Pros
	•	Full coverage of real Shopify use cases (products, orders, etc.)
	•	A single domain to unify AI-driven Storefront + Admin tasks

Cons
	•	Bigger security risk. Admin tokens can create or delete data.
	•	Harder to maintain. Potentially 2 introspections, 2 schemas, more code.
	•	Increases complexity for developers who only want a read-only test environment.

⸻

10. Conclusion

With the new info that:
	1.	We can query publicApiVersions to see which versions are available.
	2.	We also have the Admin API schema if we want to do more advanced tasks.

Our design now includes optional Admin support and a more dynamic approach to picking the Storefront version. The rest of the architecture remains consistent: a Vercel-based setup with an MCP endpoint, plus separate GraphQL proxies. This ensures we stay flexible and can accommodate real-world store usage or remain safely in mock.shop if the user prefers.

The initial implementation will provide a core set of MCP tools (`getShopInfo`, `getProductById`, `findProducts`, `getCollectionById`, `findCollections`, `cartCreate`, `cartLinesAdd`, `cartLinesUpdate`, `cartLinesRemove`, `getCart`) to enable common Storefront interactions.