import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; // Removed McpToolHandlerResult
import { z } from "zod";
import { proxyStorefrontRequest, proxyAdminRequest } from "./lib/shopifyProxy.js";
import { appConfig } from "./lib/config.js";

// ToolAnnotations type definition removed as it's not directly used in tool registration for this SDK version.
// Annotations are documented in comments for now.

// Helper to create text content for the result
// Define return type structure expected by SDK handler
type McpToolHandlerResultContent = { content: { type: "text"; text: string }[] };

function textResult(text: string): McpToolHandlerResultContent {
    return { content: [{ type: "text", text }] };
}

// Helper to create JSON content for the result
function jsonResult(data: unknown): McpToolHandlerResultContent {
    try {
        // Attempt to stringify, useful for direct API responses
        const jsonString = JSON.stringify(data, null, 2);
        return { content: [{ type: "text", text: `\`\`\`json\n${jsonString}\n\`\`\`` }] };
    } catch (e) {
        console.error(`[${new Date().toISOString()}] ERROR: Failed to stringify result data:`, e); // Added prefix
        // Fallback for non-serializable data
        return textResult(`Error: Could not serialize result data.`);
    }
}

// Helper to handle proxy results consistently
function handleProxyResult(proxyResult: { success: boolean; data: unknown }): McpToolHandlerResultContent {
    if (proxyResult.success) {
        return jsonResult(proxyResult.data);
    } else {
        // Extract error message if possible
        interface ErrorResponse { errors?: [{ message?: string }] }
        const errorData = proxyResult.data as ErrorResponse;
        const message = errorData?.errors?.[0]?.message || 'Tool execution failed via proxy.';
        // Throwing an error here will be caught by the SDK and formatted as a JSON-RPC error
        throw new Error(message);
    }
}


export function registerShopifyTools(server: McpServer) {

    // --- Storefront Tools ---

    server.tool(
        "getShopInfo",
        "Fetches basic information about the configured Shopify shop (name, description, currency). Uses the Storefront API.",
        {}, // Empty object for no input arguments
        // { annotations: { readonly: true } satisfies ToolAnnotations }, // Removed options object
        async () => {
            // Corrected query: Use paymentSettings.currencyCode instead of shop.currencyCode
            const graphQLPayload = { query: `query ShopInfo { shop { name description paymentSettings { currencyCode } } }` };
            console.error(`[${new Date().toISOString()}] INFO: [tool:getShopInfo] Executing...`); // Added timestamp
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    server.tool(
        "getProductById",
        "Fetches a specific product by its ID, optionally including variants and images. Uses the Storefront API.",
        { // Raw shape for input arguments
            productId: z.string().describe("The GID of the product (e.g., 'gid://shopify/Product/123')."),
            includeVariants: z.boolean().optional().default(false).describe("Whether to include product variants."),
            variantCount: z.number().int().positive().optional().default(5).describe("Maximum number of variants to return."),
            includeImages: z.boolean().optional().default(false).describe("Whether to include product images."),
            imageCount: z.number().int().positive().optional().default(5).describe("Maximum number of images to return."),
        },
        // { annotations: { readonly: true } satisfies ToolAnnotations }, // Removed options object
        async ({ productId, includeVariants, variantCount, includeImages, imageCount }) => {
            const query = `query GetProduct($productId: ID!, $variantCount: Int!, $imageCount: Int!) {
              product(id: $productId) {
                id
                title
                descriptionHtml
                vendor
                ${includeVariants ? `variants(first: $variantCount) { edges { node { id title price { amount currencyCode } selectedOptions { name value } } } }` : ''}
                ${includeImages ? `images(first: $imageCount) { edges { node { id url altText width height } } }` : ''}
              }
            }`;
            const graphQLPayload = { query, variables: { productId, variantCount, imageCount } };
            console.error(`[${new Date().toISOString()}] INFO: [tool:getProductById] Executing for ID: ${productId}`); // Added timestamp
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    server.tool(
        "findProducts",
        "Searches or filters products with pagination and sorting. Uses the Storefront API.",
        { // Raw shape for input arguments
            query: z.string().optional().describe("The search query string."),
            first: z.number().int().positive().optional().default(10).describe("Number of products per page."),
            after: z.string().optional().describe("Cursor for pagination (from previous pageInfo.endCursor)."),
            sortKey: z.enum(['RELEVANCE', 'TITLE', 'PRICE', 'CREATED_AT', 'UPDATED_AT', 'BEST_SELLING', 'PRODUCT_TYPE', 'VENDOR']).optional().default('RELEVANCE').describe("Sort key (e.g., TITLE, PRICE)."),
            reverse: z.boolean().optional().default(false).describe("Reverse the sort order."),
        },
        // { annotations: { readonly: true } satisfies ToolAnnotations }, // Removed options object
        async ({ query: searchQuery, first, after, sortKey, reverse }) => {
             const query = `
                query FindProducts($first: Int!, $after: String, $query: String, $sortKey: ProductSortKeys, $reverse: Boolean) {
                  products(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                    edges {
                      cursor
                      node {
                        id
                        title
                        handle
                        vendor
                        priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
                      }
                    }
                  }
                }
            `;
            const graphQLPayload = { query, variables: { first, after, query: searchQuery, sortKey, reverse } };
            console.error(`[${new Date().toISOString()}] INFO: [tool:findProducts] Executing with query: ${searchQuery}`); // Added timestamp
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

     server.tool(
        "getCollectionById",
        "Fetches a specific collection by its ID, optionally including products. Uses the Storefront API.",
        { // Raw shape for input arguments
            collectionId: z.string().describe("The GID of the collection (e.g., 'gid://shopify/Collection/123')."),
            includeProducts: z.boolean().optional().default(false).describe("Whether to include products in the collection."),
            productCount: z.number().int().positive().optional().default(10).describe("Maximum number of products to return."),
        },
        // { annotations: { readonly: true } satisfies ToolAnnotations }, // Removed options object
        async ({ collectionId, includeProducts, productCount }) => {
            const query = `
                query GetCollection($collectionId: ID!, $productCount: Int!) {
                  collection(id: $collectionId) {
                    id
                    title
                    descriptionHtml
                    handle
                    ${includeProducts ? `products(first: $productCount) { edges { node { id title handle vendor } } }` : ''}
                  }
                }
            `;
            const graphQLPayload = { query, variables: { collectionId, productCount } };
            console.error(`[${new Date().toISOString()}] INFO: [tool:getCollectionById] Executing for ID: ${collectionId}`); // Added timestamp
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    server.tool(
        "findCollections",
        "Searches or filters collections with pagination and sorting. Uses the Storefront API.",
         { // Raw shape for input arguments
            query: z.string().optional().describe("The search query string."),
            first: z.number().int().positive().optional().default(10).describe("Number of collections per page."),
            after: z.string().optional().describe("Cursor for pagination (from previous pageInfo.endCursor)."),
            sortKey: z.enum(['RELEVANCE', 'TITLE', 'UPDATED_AT']).optional().default('RELEVANCE').describe("Sort key (e.g., TITLE, UPDATED_AT)."),
            reverse: z.boolean().optional().default(false).describe("Reverse the sort order."),
        },
        // { annotations: { readonly: true } satisfies ToolAnnotations }, // Removed options object
        async ({ query: searchQuery, first, after, sortKey, reverse }) => {
            const query = `
                query FindCollections($first: Int!, $after: String, $query: String, $sortKey: CollectionSortKeys, $reverse: Boolean) {
                  collections(first: $first, after: $after, query: $query, sortKey: $sortKey, reverse: $reverse) {
                    pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
                    edges {
                      cursor
                      node {
                        id
                        title
                        handle
                        description
                      }
                    }
                  }
                }
            `;
            const graphQLPayload = { query, variables: { first, after, query: searchQuery, sortKey, reverse } };
            console.error(`[${new Date().toISOString()}] INFO: [tool:findCollections] Executing with query: ${searchQuery}`); // Added timestamp
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    // --- Cart Tools ---
    // Define Zod schemas for complex inputs
    const CartLineInputSchema = z.object({
        merchandiseId: z.string().describe("The GID of the product variant."),
        quantity: z.number().int().positive().describe("The quantity of the variant."),
        attributes: z.array(z.object({ key: z.string(), value: z.string() })).optional().describe("Custom attributes for the line item."),
    }).describe("Input for a single cart line item.");

    const CartBuyerIdentityInputSchema = z.object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
        countryCode: z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code."),
        // Add other fields like customerAccessToken if needed
    }).describe("Input for buyer identity information.");

    const AttributeInputSchema = z.object({
        key: z.string(),
        value: z.string(),
    }).describe("Input for a custom cart attribute.");

    server.tool(
        "cartCreate",
        "Creates a new shopping cart. Uses the Storefront API.",
        { // Raw shape for input arguments
            lines: z.array(CartLineInputSchema).optional().describe("Initial line items to add to the cart."),
            buyerIdentity: CartBuyerIdentityInputSchema.optional().describe("Information about the buyer."),
            attributes: z.array(AttributeInputSchema).optional().describe("Custom attributes for the cart."),
        },
        // { annotations: { readonly: false, destructive: false, idempotent: false } satisfies ToolAnnotations }, // Removed options object
        async ({ lines, buyerIdentity, attributes }) => {
            const mutation = `
                mutation CartCreate($input: CartInput!) {
                  cartCreate(input: $input) {
                    cart { id checkoutUrl cost { totalAmount { amount currencyCode } } lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title product { title } } } } } } }
                    userErrors { field message }
                  }
                }
            `;
            const input: { lines?: unknown; buyerIdentity?: unknown; attributes?: unknown } = {};
            if (lines) input.lines = lines;
            if (buyerIdentity) input.buyerIdentity = buyerIdentity;
            if (attributes) input.attributes = attributes;

            const graphQLPayload = { query: mutation, variables: { input } };
            console.error(`[${new Date().toISOString()}] INFO: [tool:cartCreate] Executing...`); // Added timestamp
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

     server.tool(
        "cartLinesAdd",
        "Adds line items to an existing shopping cart. Uses the Storefront API.",
        { // Raw shape for input arguments
            cartId: z.string().describe("The GID of the cart to modify."),
            lines: z.array(CartLineInputSchema).min(1).describe("Line items to add."),
        },
        // { annotations: { readonly: false, destructive: false, idempotent: false } satisfies ToolAnnotations }, // Removed options object
        async ({ cartId, lines }) => {
             const mutation = `
                mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
                  cartLinesAdd(cartId: $cartId, lines: $lines) {
                    cart { id checkoutUrl cost { totalAmount { amount currencyCode } } lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title product { title } } } } } } }
                    userErrors { field message }
                  }
                }
            `;
            const graphQLPayload = { query: mutation, variables: { cartId, lines } };
            console.error(`[${new Date().toISOString()}] INFO: [tool:cartLinesAdd] Executing for cart ID: ${cartId}`); // Added timestamp
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    const CartLineUpdateInputSchema = z.object({
        id: z.string().describe("The GID of the cart line to update."),
        quantity: z.number().int().nonnegative().describe("The new quantity (0 to remove)."),
        merchandiseId: z.string().optional().describe("Optional: New variant GID if changing the variant."),
        attributes: z.array(z.object({ key: z.string(), value: z.string() })).optional().describe("Optional: New custom attributes."),
    }).describe("Input for updating a single cart line item.");

    server.tool(
        "cartLinesUpdate",
        "Updates line items (e.g., quantity) in an existing shopping cart. Uses the Storefront API.",
        { // Raw shape for input arguments
            cartId: z.string().describe("The GID of the cart to modify."),
            lines: z.array(CartLineUpdateInputSchema).min(1).describe("Line items to update."),
        },
        // { annotations: { readonly: false, destructive: false, idempotent: true } satisfies ToolAnnotations }, // Removed options object
        async ({ cartId, lines }) => {
            const mutation = `
                mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
                  cartLinesUpdate(cartId: $cartId, lines: $lines) {
                    cart { id checkoutUrl cost { totalAmount { amount currencyCode } } lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title product { title } } } } } } }
                    userErrors { field message }
                  }
                }
            `;
            const graphQLPayload = { query: mutation, variables: { cartId, lines } };
            console.error(`[${new Date().toISOString()}] INFO: [tool:cartLinesUpdate] Executing for cart ID: ${cartId}`); // Added timestamp
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    server.tool(
        "cartLinesRemove",
        "Removes line items from an existing shopping cart. Uses the Storefront API.",
        { // Raw shape for input arguments
            cartId: z.string().describe("The GID of the cart to modify."),
            lineIds: z.array(z.string()).min(1).describe("Array of cart line GIDs to remove."),
        },
        // { annotations: { readonly: false, destructive: false, idempotent: true } satisfies ToolAnnotations }, // Removed options object
        async ({ cartId, lineIds }) => {
             const mutation = `
                mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
                  cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
                    cart { id checkoutUrl cost { totalAmount { amount currencyCode } } lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title product { title } } } } } } }
                    userErrors { field message }
                  }
                }
            `;
            const graphQLPayload = { query: mutation, variables: { cartId, lineIds } };
            console.error(`[${new Date().toISOString()}] INFO: [tool:cartLinesRemove] Executing for cart ID: ${cartId}`); // Added timestamp
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    server.tool(
        "getCart",
        "Fetches the details of an existing shopping cart by its ID. Uses the Storefront API.",
        { // Raw shape for input arguments
            cartId: z.string().describe("The GID of the cart to fetch."),
        },
        // { annotations: { readonly: true } satisfies ToolAnnotations }, // Removed options object
        async ({ cartId }) => {
            const query = `
                query GetCart($cartId: ID!) {
                  cart(id: $cartId) {
                    id
                    createdAt
                    updatedAt
                    checkoutUrl
                    cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } totalTaxAmount { amount currencyCode } totalDutyAmount { amount currencyCode } }
                    lines(first: 50) {
                      edges {
                        node {
                          id
                          quantity
                          cost { totalAmount { amount currencyCode } }
                          merchandise {
                            ... on ProductVariant {
                              id
                              title
                              price { amount currencyCode }
                              product { id title handle }
                            }
                          }
                        }
                      }
                    }
                    buyerIdentity { email phone countryCode customer { id } }
                    attributes { key value }
                  }
                }
            `;
            const graphQLPayload = { query, variables: { cartId } };
            console.error(`[${new Date().toISOString()}] INFO: [tool:getCart] Executing for cart ID: ${cartId}`); // Added timestamp
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );


    // --- Admin Tools (Conditional) ---
    if (appConfig.adminApi.enabled) {
        console.error(`[${new Date().toISOString()}] INFO: Admin API enabled, registering Admin tools.`); // Added timestamp

        server.tool(
            "getCustomerById",
            "Retrieves a specific customer using the Admin API.",
            { // Raw shape for input arguments
                customerId: z.string().describe("The GID of the customer (e.g., 'gid://shopify/Customer/123')."),
            },
            // { annotations: { readonly: true } satisfies ToolAnnotations }, // Removed options object
            async ({ customerId }) => {
                const query = `query GetCustomer($id: ID!) { customer(id: $id) { id email firstName lastName phone } }`;
                const graphQLPayload = { query, variables: { id: customerId } };
                console.error(`[${new Date().toISOString()}] AUDIT: Executing Admin tool: getCustomerById for ID: ${customerId}`); // Added timestamp
                const proxyResult = await proxyAdminRequest(graphQLPayload);
                return handleProxyResult(proxyResult);
            }
        );

        // Define Zod schema for ProductInput (simplified example)
        // A real implementation should match the Admin API schema more closely
        const ProductInputSchema = z.object({
            title: z.string().min(1),
            bodyHtml: z.string().optional(),
            vendor: z.string().optional(),
            productType: z.string().optional(),
            status: z.enum(['ACTIVE', 'ARCHIVED', 'DRAFT']).optional(),
            // Add other fields like variants, images, options etc. as needed
        }).passthrough(); // Allow extra fields not explicitly defined

        server.tool(
            "createProduct",
            "Creates a new product using the Admin API.",
            { // Raw shape for input arguments
                input: ProductInputSchema.describe("The ProductInput object containing product details."),
            },
            // { annotations: { readonly: false, destructive: false, idempotent: false } satisfies ToolAnnotations }, // Removed options object
            async ({ input }) => {
                 const mutation = `
                    mutation ProductCreate($input: ProductInput!) {
                      productCreate(input: $input) {
                        product {
                          id
                          title
                          handle
                          vendor
                          status
                        }
                        userErrors {
                          field
                          message
                        }
                      }
                    }`;
                const graphQLPayload = { query: mutation, variables: { input } };
                console.error(`[${new Date().toISOString()}] AUDIT: Executing Admin tool: createProduct`); // Added timestamp
                const proxyResult = await proxyAdminRequest(graphQLPayload);
                return handleProxyResult(proxyResult);
            }
        );

        // Example Admin Tool (if needed for testing)
        server.tool(
            "exampleAdminTool",
            "Placeholder for an admin-only tool (expects raw query).",
            { // Raw shape for input arguments
                query: z.string().describe("The raw GraphQL query/mutation string."),
                variables: z.record(z.unknown()).optional().describe("Optional variables for the query."),
            },
            // { annotations: { readonly: false, destructive: true, idempotent: false } satisfies ToolAnnotations }, // Removed options object
            async ({ query, variables }) => {
                const graphQLPayload = { query, variables };
                console.error(`[${new Date().toISOString()}] AUDIT: Executing Admin tool: exampleAdminTool with client-provided query`); // Added timestamp
                const proxyResult = await proxyAdminRequest(graphQLPayload);
                return handleProxyResult(proxyResult);
            }
        );

    } else {
         console.error(`[${new Date().toISOString()}] INFO: Admin API disabled, skipping Admin tool registration.`); // Added timestamp
    }
}