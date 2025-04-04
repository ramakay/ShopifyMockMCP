import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// No axios needed for this approach
import { z } from "zod";
import { proxyStorefrontRequest } from "./lib/shopifyProxy.js";
// import { appConfig } from "./lib/config.js"; // Not needed if Admin tools are omitted

// --- Define Content Block Types ---
// Only TextContentBlock needed
type TextContentBlock = {
    type: "text";
    text: string;
};

// Define the overall result structure
type McpToolResult = { content: TextContentBlock[] };

// --- Helper Functions ---

function textResult(text: string): McpToolResult {
    return { content: [{ type: "text", text }] };
}

// jsonResult returns the data within a text block
function jsonResult(data: unknown): McpToolResult {
    try {
        const jsonString = JSON.stringify(data, null, 2);
        return { content: [{ type: "text", text: `\`\`\`json\n${jsonString}\n\`\`\`` }] };
    } catch (e) {
        console.error(`[${new Date().toISOString()}] ERROR: Failed to stringify result data:`, e);
        return textResult(`Error: Could not serialize result data.`);
    }
}

// handleProxyResult uses jsonResult
function handleProxyResult(proxyResult: { success: boolean; data: unknown }): McpToolResult {
    if (proxyResult.success) {
        return jsonResult(proxyResult.data);
    } else {
        interface ErrorResponse { errors?: [{ message?: string }] }
        const errorData = proxyResult.data as ErrorResponse;
        const message = errorData?.errors?.[0]?.message || 'Tool execution failed via proxy.';
        throw new Error(message);
    }
}


export function registerShopifyTools(server: McpServer) {

    // --- Storefront Tools ---

    server.tool(
        "getShopInfo",
        "Fetches basic information about the configured Shopify shop.",
        {},
        async () => {
            const graphQLPayload = { query: `query ShopInfo { shop { name description paymentSettings { currencyCode } } }` };
            console.error(`[${new Date().toISOString()}] INFO: [tool:getShopInfo] Executing...`);
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    server.tool(
        "getProductById",
        "Fetches product by ID. If includeImages=true, also returns the URL of the first image (resized to 75px).",
        {
            productId: z.string().describe("The GID of the product (e.g., 'gid://shopify/Product/123')."),
            includeVariants: z.boolean().optional().default(false).describe("Whether to include product variants."),
            variantCount: z.number().int().positive().optional().default(5).describe("Maximum number of variants to return."),
            includeImages: z.boolean().optional().default(false).describe("Return first image URL (75px)?"),
        },
        async ({ productId, includeVariants, variantCount, includeImages }) => {
            const imageCountForQuery = includeImages ? 1 : 0; // Only need URL if requested
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
            const graphQLPayload = { query, variables: { productId, variantCount, imageCount: imageCountForQuery } };
            console.error(`[${new Date().toISOString()}] INFO: [tool:getProductById] Executing for ID: ${productId}`);
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);

            // If successful AND image URL requested
            if (proxyResult.success && includeImages) {
                 interface ProductData { // Define expected structure
                    id?: string;
                    title?: string;
                    descriptionHtml?: string;
                    vendor?: string;
                    variants?: { edges: any[] };
                    images?: { edges: { node: { url: string; altText?: string; width?: number; height?: number } }[] };
                }
                const responseData = proxyResult.data as { data?: { product?: ProductData } };
                const product = responseData?.data?.product;
                const firstImageEdge = product?.images?.edges?.[0];

                if (product && firstImageEdge) {
                    const img = firstImageEdge.node;
                    const contentBlocks: TextContentBlock[] = [];

                    // Create productInfo copy for JSON, excluding images array
                    const productInfoForJson = { ...product };
                    delete productInfoForJson.images;

                    // Add JSON details block
                    contentBlocks.push({ type: "text", text: `Product Details:\n\`\`\`json\n${JSON.stringify(productInfoForJson, null, 2)}\n\`\`\`` });

                    // Construct resized image URL
                    const separator = img.url.includes('?') ? '&' : '?';
                    const resizedImageUrl = `${img.url}${separator}width=75`; // Use width=75

                    // Add the resized image URL as a separate text block
                    contentBlocks.push({ type: "text", text: `Image URL (75px): ${resizedImageUrl}` });

                    console.error(`[${new Date().toISOString()}] INFO: [getProductById] Returning product JSON and resized image URL.`);
                    return { content: contentBlocks };
                }
            }
            // Fallback if no images requested/found or if proxy failed
            return handleProxyResult(proxyResult); // Returns original data wrapped by jsonResult
        }
    );

    // Add other Storefront tools back (omitting Admin tools for now)
    server.tool(
        "findProducts",
        "Searches or filters products with pagination and sorting. Uses the Storefront API.",
        {
            query: z.string().optional().describe("The search query string."),
            first: z.number().int().positive().optional().default(10).describe("Number of products per page."),
            after: z.string().optional().describe("Cursor for pagination (from previous pageInfo.endCursor)."),
            sortKey: z.enum(['RELEVANCE', 'TITLE', 'PRICE', 'CREATED_AT', 'UPDATED_AT', 'BEST_SELLING', 'PRODUCT_TYPE', 'VENDOR']).optional().default('RELEVANCE').describe("Sort key (e.g., TITLE, PRICE)."),
            reverse: z.boolean().optional().default(false).describe("Reverse the sort order."),
        },
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
            console.error(`[${new Date().toISOString()}] INFO: [tool:findProducts] Executing with query: ${searchQuery}`);
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

     server.tool(
        "getCollectionById",
        "Fetches a specific collection by its ID, optionally including products. Uses the Storefront API.",
        {
            collectionId: z.string().describe("The GID of the collection (e.g., 'gid://shopify/Collection/123')."),
            includeProducts: z.boolean().optional().default(false).describe("Whether to include products in the collection."),
            productCount: z.number().int().positive().optional().default(10).describe("Maximum number of products to return."),
        },
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
            console.error(`[${new Date().toISOString()}] INFO: [tool:getCollectionById] Executing for ID: ${collectionId}`);
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    server.tool(
        "findCollections",
        "Searches or filters collections with pagination and sorting. Uses the Storefront API.",
         {
            query: z.string().optional().describe("The search query string."),
            first: z.number().int().positive().optional().default(10).describe("Number of collections per page."),
            after: z.string().optional().describe("Cursor for pagination (from previous pageInfo.endCursor)."),
            sortKey: z.enum(['RELEVANCE', 'TITLE', 'UPDATED_AT']).optional().default('RELEVANCE').describe("Sort key (e.g., TITLE, UPDATED_AT)."),
            reverse: z.boolean().optional().default(false).describe("Reverse the sort order."),
        },
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
            console.error(`[${new Date().toISOString()}] INFO: [tool:findCollections] Executing with query: ${searchQuery}`);
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    // --- Cart Tools ---
    const CartLineInputSchema = z.object({
        merchandiseId: z.string().describe("The GID of the product variant."),
        quantity: z.number().int().positive().describe("The quantity of the variant."),
        attributes: z.array(z.object({ key: z.string(), value: z.string() })).optional().describe("Custom attributes for the line item."),
    }).describe("Input for a single cart line item.");

    const CartBuyerIdentityInputSchema = z.object({
        email: z.string().email().optional(),
        phone: z.string().optional(),
        countryCode: z.string().length(2).optional().describe("ISO 3166-1 alpha-2 country code."),
    }).describe("Input for buyer identity information.");

    const AttributeInputSchema = z.object({
        key: z.string(),
        value: z.string(),
    }).describe("Input for a custom cart attribute.");

    server.tool(
        "cartCreate",
        "Creates a new shopping cart. Uses the Storefront API.",
        {
            lines: z.array(CartLineInputSchema).optional().describe("Initial line items to add to the cart."),
            buyerIdentity: CartBuyerIdentityInputSchema.optional().describe("Information about the buyer."),
            attributes: z.array(AttributeInputSchema).optional().describe("Custom attributes for the cart."),
        },
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
            console.error(`[${new Date().toISOString()}] INFO: [tool:cartCreate] Executing...`);
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

     server.tool(
        "cartLinesAdd",
        "Adds line items to an existing shopping cart. Uses the Storefront API.",
        {
            cartId: z.string().describe("The GID of the cart to modify."),
            lines: z.array(CartLineInputSchema).min(1).describe("Line items to add."),
        },
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
            console.error(`[${new Date().toISOString()}] INFO: [tool:cartLinesAdd] Executing for cart ID: ${cartId}`);
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
        {
            cartId: z.string().describe("The GID of the cart to modify."),
            lines: z.array(CartLineUpdateInputSchema).min(1).describe("Line items to update."),
        },
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
            console.error(`[${new Date().toISOString()}] INFO: [tool:cartLinesUpdate] Executing for cart ID: ${cartId}`);
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    server.tool(
        "cartLinesRemove",
        "Removes line items from an existing shopping cart. Uses the Storefront API.",
        {
            cartId: z.string().describe("The GID of the cart to modify."),
            lineIds: z.array(z.string()).min(1).describe("Array of cart line GIDs to remove."),
        },
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
            console.error(`[${new Date().toISOString()}] INFO: [tool:cartLinesRemove] Executing for cart ID: ${cartId}`);
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    server.tool(
        "getCart",
        "Fetches the details of an existing shopping cart by its ID. Uses the Storefront API.",
        {
            cartId: z.string().describe("The GID of the cart to fetch."),
        },
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
            console.error(`[${new Date().toISOString()}] INFO: [tool:getCart] Executing for cart ID: ${cartId}`);
            const proxyResult = await proxyStorefrontRequest(graphQLPayload);
            return handleProxyResult(proxyResult);
        }
    );

    // Admin tools section removed
}