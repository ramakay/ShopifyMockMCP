import { NextRequest, NextResponse } from 'next/server';
import { appConfig } from '@/lib/config';
import { resolveStorefrontApiVersion, resolveAdminApiVersion } from '@/lib/versionManager';
import { proxyStorefrontRequest, proxyAdminRequest } from '@/lib/shopifyProxy';
import { getStorefrontSchema, getAdminSchema } from '@/lib/schemaManager';
import { buildSchema, parse, validate } from 'graphql'; // Removed unused GraphQLError, GraphQLSchema
interface JsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown[] | object;
  id: string | number | null;
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: JsonRpcError;
  id: string | number | null;
}

// --- Define Capability Types ---
// Define basic types for capabilities (expand later)
interface CapabilityBase {
  name: string;
  description: string;
}
// --- Define Tool Annotation Types ---
// Based on MCP Spec PR #185 discussion
interface ReadOnlyAnnotation {
  readonly: true;
}

interface WritableAnnotation {
  readonly: false;
  destructive: boolean; // true if data loss can occur (delete)
  idempotent: boolean; // true if multiple calls have same effect as one (delete, update)
}

type ToolAnnotations = ReadOnlyAnnotation | WritableAnnotation;
// --- End Tool Annotation Types ---


interface ToolDefinition extends CapabilityBase {
  // Add tool-specific fields later if needed (e.g., input/output schema)
  annotations: ToolAnnotations; // Added annotations field
}
interface ResourceDefinition extends CapabilityBase {
   uri?: string; // Example resource field
}
interface PromptDefinition extends CapabilityBase {
   text?: string; // Example prompt field
}
// --- End Capability Types ---

// ToolExecutionParams interface removed as it was unused.
// Type checking for tool parameters is handled inline.
// Standard JSON-RPC Error Codes
const JSON_RPC_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

function createJsonRpcError(id: string | number | null, code: number, message: string, data?: unknown): NextResponse {
  const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    error: { code, message, data },
    id,
  };
  // Determine appropriate HTTP status code based on JSON-RPC error
  let httpStatus = 500; // Default Internal Error
  if (code === JSON_RPC_ERROR_CODES.PARSE_ERROR || code === JSON_RPC_ERROR_CODES.INVALID_REQUEST) {
    httpStatus = 400; // Bad Request
  } else if (code === JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND) {
    httpStatus = 404; // Not Found (or 501 Not Implemented)
  } else if (code === JSON_RPC_ERROR_CODES.INVALID_PARAMS) {
    httpStatus = 400; // Bad Request for Invalid Params too
  }
  return NextResponse.json(response, { status: httpStatus });
}

function createJsonRpcSuccess(id: string | number | null, result: unknown): NextResponse {
   const response: JsonRpcResponse = {
    jsonrpc: '2.0',
    result,
    id,
  };
  return NextResponse.json(response, { status: 200 });
}

/**
 * Helper function to validate a GraphQL query string against the appropriate schema.
 * @param query The GraphQL query string to validate.
 * @param schemaType 'storefront' or 'admin'.
 * @returns Promise<{ valid: boolean; errors?: { message: string; locations: readonly unknown[] | undefined }[] }> // Changed any to unknown
 */
async function validateGraphQLQuery(
    query: string,
    schemaType: 'storefront' | 'admin'
): Promise<{ valid: boolean; errors?: { message: string; locations: readonly unknown[] | undefined }[] }> { // Changed any to unknown
    let schemaString: string | null;
    try {
        if (schemaType === 'storefront') {
            schemaString = await getStorefrontSchema();
        } else { // admin
            schemaString = await getAdminSchema(); // Returns null if admin disabled
        }

        if (!schemaString) {
            // If schema couldn't be loaded (e.g., admin disabled), skip validation
            console.log(`Skipping validation as ${schemaType} schema is not available.`);
            return { valid: true };
        }

        const schema = buildSchema(schemaString);
        const documentNode = parse(query);
        const validationErrors = validate(schema, documentNode);

        if (validationErrors.length > 0) {
            console.error(`GraphQL validation failed for ${schemaType} query:`, validationErrors);
            const formattedErrors = validationErrors.map((e) => ({
                message: e.message,
                locations: e.locations,
            }));
            return { valid: false, errors: formattedErrors };
        }

        console.log(`GraphQL validation successful for ${schemaType} query.`);
        return { valid: true };

    } catch (error) {
        console.error(`Error during GraphQL query validation (schemaType: ${schemaType}):`, error);
        // Treat schema build/parse errors as validation failures
        return {
            valid: false,
            errors: [{ message: `Internal error during query validation: ${error instanceof Error ? error.message : String(error)}`, locations: undefined }],
        };
    }
}


/**
 * Handles POST requests to the MCP JSON-RPC endpoint.
 */
export async function POST(request: NextRequest) {
  let requestBody: unknown;
  let requestId: string | number | null = null; // Keep track of ID for error responses

  try {
    requestBody = await request.json();
  } catch (error) {
    console.error('MCP Endpoint: Failed to parse JSON request body:', error);
    return createJsonRpcError(null, JSON_RPC_ERROR_CODES.PARSE_ERROR, 'Parse error');
  }

  // Basic validation of JSON-RPC structure
  if (
    typeof requestBody !== 'object' ||
    requestBody === null ||
    (requestBody as JsonRpcRequest).jsonrpc !== '2.0' ||
    typeof (requestBody as JsonRpcRequest).method !== 'string' ||
    !('id' in requestBody) // id is mandatory, even if null
  ) {
    return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_REQUEST, 'Invalid Request');
  }

  const jsonRpcRequest = requestBody as JsonRpcRequest;
  requestId = jsonRpcRequest.id; // Now we have the ID

  console.log(`MCP Request Received: Method=${jsonRpcRequest.method}, ID=${requestId}`);

  // --- Method Routing (Placeholder) ---
  // In subsequent tasks, we will add a switch statement or router here
  // based on jsonRpcRequest.method to call specific handler functions.

  try {
    switch (jsonRpcRequest.method) {
      case 'initialize': {
        // Resolve versions asynchronously
        const storefrontVersion = await resolveStorefrontApiVersion();
        const adminVersion = await resolveAdminApiVersion(); // Returns null if admin disabled

        const capabilities: {
            prompts: PromptDefinition[];
            resources: ResourceDefinition[];
            tools: ToolDefinition[];
            versions: { storefront: string; admin: string | null };
            adminApiEnabled: boolean;
         } = {
          prompts: [],
          resources: [],
          tools: [],
          versions: {
            storefront: storefrontVersion,
            admin: adminVersion, // Will be null if admin is disabled
          },
          // Indicate if admin features are active based on config
          adminApiEnabled: appConfig.adminApi.enabled,
        };

        // Add example tools with annotations if enabled/needed for initialize response
        if (appConfig.adminApi.enabled) {
            capabilities.tools.push({
                name: 'exampleAdminTool',
                description: 'Placeholder for an admin-only tool',
                annotations: { readonly: false, destructive: true, idempotent: false } // Example annotation
            });
        }
         capabilities.tools.push({
             name: 'exampleStorefrontTool',
             description: 'Placeholder for a storefront tool',
             annotations: { readonly: true } // Example annotation
         });


        console.log('MCP Initialize: Returning capabilities', capabilities);
        return createJsonRpcSuccess(requestId, capabilities);
      }

      case 'prompts': {
        // Placeholder: Load from static definitions later
        const prompts: PromptDefinition[] = [
          { name: 'examplePrompt', description: 'An example prompt definition', text: 'Explain the concept of {topic}.' }
        ];
        console.log('MCP Prompts: Returning definitions');
        return createJsonRpcSuccess(requestId, prompts);
      }

      case 'resources': {
         // Placeholder: Load from static definitions later
        const resources: ResourceDefinition[] = [
           { name: 'storefrontSchema', description: 'The GraphQL schema for the Storefront API', uri: 'mcp://schemas/storefront' },
        ];
         if (appConfig.adminApi.enabled) {
            resources.push({ name: 'adminSchema', description: 'The GraphQL schema for the Admin API', uri: 'mcp://schemas/admin' });
         }
        console.log('MCP Resources: Returning definitions');
        return createJsonRpcSuccess(requestId, resources);
      }

       case 'tools': {
         // Placeholder: Load from static definitions later
         const tools: ToolDefinition[] = [
            // Define the 10 core Storefront tools
            {
              name: 'getShopInfo',
              description: 'Fetches basic information about the configured Shopify shop (name, description, currency). Uses the Storefront API.',
              annotations: { readonly: true },
              // TODO: Add input/output schema definition
            },
            {
              name: 'getProductById',
              description: 'Fetches a specific product by its ID, optionally including variants and images. Uses the Storefront API.',
              annotations: { readonly: true },
              // TODO: Add input/output schema definition (args: productId, includeVariants, variantCount, includeImages, imageCount)
            },
            {
              name: 'findProducts',
              description: 'Searches or filters products with pagination and sorting. Uses the Storefront API.',
              annotations: { readonly: true },
              // TODO: Add input/output schema definition (args: query, first, after, sortKey, reverse)
            },
            {
              name: 'getCollectionById',
              description: 'Fetches a specific collection by its ID, optionally including products. Uses the Storefront API.',
              annotations: { readonly: true },
              // TODO: Add input/output schema definition (args: collectionId, includeProducts, productCount)
            },
            {
              name: 'findCollections',
              description: 'Searches or filters collections with pagination and sorting. Uses the Storefront API.',
              annotations: { readonly: true },
              // TODO: Add input/output schema definition (args: query, first, after, sortKey, reverse)
            },
            {
              name: 'cartCreate',
              description: 'Creates a new shopping cart. Uses the Storefront API.',
              // Note: Cart mutations modify state but are generally not considered 'destructive' in the sense of data loss.
              // They are also typically not idempotent (creating multiple carts).
              annotations: { readonly: false, destructive: false, idempotent: false },
              // TODO: Add input/output schema definition (args: lines, buyerIdentity, attributes)
            },
            {
              name: 'cartLinesAdd',
              description: 'Adds line items to an existing shopping cart. Uses the Storefront API.',
              // Not idempotent if adding the same variant multiple times increases quantity vs. adding separate lines. Let's assume not idempotent for safety.
              annotations: { readonly: false, destructive: false, idempotent: false },
              // TODO: Add input/output schema definition (args: cartId, lines)
            },
            {
              name: 'cartLinesUpdate',
              description: 'Updates line items (e.g., quantity) in an existing shopping cart. Uses the Storefront API.',
              // Updating to the same quantity is idempotent.
              annotations: { readonly: false, destructive: false, idempotent: true },
              // TODO: Add input/output schema definition (args: cartId, lines)
            },
            {
              name: 'cartLinesRemove',
              description: 'Removes line items from an existing shopping cart. Uses the Storefront API.',
              // Removing the same line ID multiple times has the same effect as removing it once.
              annotations: { readonly: false, destructive: false, idempotent: true }, // Not destructive data loss, just removes from cart
              // TODO: Add input/output schema definition (args: cartId, lineIds)
            },
            {
              name: 'getCart',
              description: 'Fetches the details of an existing shopping cart by its ID. Uses the Storefront API.',
              annotations: { readonly: true },
              // TODO: Add input/output schema definition (args: cartId)
            }
         ];
         if (appConfig.adminApi.enabled) {
            // Add placeholder annotation for example admin tool
            tools.push({
                name: 'exampleAdminTool',
                description: 'Placeholder for an admin-only tool',
                annotations: { readonly: false, destructive: true, idempotent: false } // Example: Assume it's destructive and not idempotent
            });
            // Add initial Admin API tools if enabled
            tools.push({
                name: 'getCustomerById',
                description: 'Retrieves a specific customer using the Admin API.',
                annotations: { readonly: true },
                // TODO: Add input/output schema definition (args: customerId)
            });
            tools.push({
                name: 'createProduct',
                description: 'Creates a new product using the Admin API.',
                annotations: { readonly: false, destructive: false, idempotent: false },
                // TODO: Add input/output schema definition (args: input - ProductInput object)
            });
         }
        console.log('MCP Tools: Returning definitions');
        return createJsonRpcSuccess(requestId, tools);
      }

      case 'tool': {
        // Type guard for basic tool parameters (name is required)
        const params = jsonRpcRequest.params;
        const isValidBaseParams = (p: unknown): p is { name: string; arguments?: unknown } => {
          return (
            typeof p === 'object' &&
            p !== null &&
            typeof (p as { name: string }).name === 'string'
          );
        };

        if (!isValidBaseParams(params)) {
           return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'Invalid tool parameters. Expected { name: string, arguments?: object }');
        }

        const toolName = params.name;
        // Client arguments are optional, specific tools decide how to use them
        const toolClientArgs = typeof params.arguments === 'object' && params.arguments !== null
            ? params.arguments as Record<string, unknown>
            : {}; // Default to empty object if not provided or not an object

        console.log(`MCP Tool Execution: Name=${toolName}, ClientArgs=${JSON.stringify(toolClientArgs)}`);

        let proxyResult;
        // Removed inner try...catch as proxy functions now consistently return ProxyResult

        // Determine which proxy to use and construct the actual GraphQL query/variables
        let graphQLPayload: { query: string; variables?: Record<string, unknown> };

        // --- Tool Execution Switch ---
        switch (toolName) {
          case 'getShopInfo': {
            graphQLPayload = { query: `query ShopInfo { shop { name description currencyCode } }` };
            // --- Validate Query ---
            const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'storefront');
            if (!validationResult.valid) {
                // Return INVALID_PARAMS if validation fails
                return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
            }
            // --- Execute ---
            console.log(`Executing ${toolName}`);
            proxyResult = await proxyStorefrontRequest(graphQLPayload);
            break;
          }

          case 'getProductById': {
            const { productId, includeVariants = false, variantCount = 5, includeImages = false, imageCount = 5 } = toolClientArgs;
            if (typeof productId !== 'string') {
              return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.productId' of type string.`);
            }
            // Construct query dynamically based on options
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
            graphQLPayload = {
              query,
              variables: { productId, variantCount, imageCount },
            };
            // --- Validate Query ---
            const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'storefront');
            if (!validationResult.valid) {
                 // Return INVALID_PARAMS if validation fails
                return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
            }
            // --- Execute ---
            console.log(`Executing ${toolName} for ID: ${productId}`);
            proxyResult = await proxyStorefrontRequest(graphQLPayload);
            break;
          }

          case 'findProducts': {
              const { query: searchQuery, first = 10, after, sortKey = 'RELEVANCE', reverse = false } = toolClientArgs;
              // Basic validation for argument types
              if (searchQuery !== undefined && typeof searchQuery !== 'string') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' optional argument 'query' must be a string.`);
              if (typeof first !== 'number') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' argument 'first' must be a number.`);
              if (after !== undefined && typeof after !== 'string') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' optional argument 'after' must be a string.`);
              if (typeof sortKey !== 'string') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' argument 'sortKey' must be a string (ProductSortKeys enum).`);
              if (typeof reverse !== 'boolean') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' argument 'reverse' must be a boolean.`);

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
              graphQLPayload = {
                  query,
                  variables: { first, after, query: searchQuery, sortKey, reverse },
              };
              // --- Validate Query ---
              const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'storefront');
              if (!validationResult.valid) {
                   // Return INVALID_PARAMS if validation fails
                  return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
              }
              // --- Execute ---
              console.log(`Executing ${toolName} with query: ${searchQuery}`);
              proxyResult = await proxyStorefrontRequest(graphQLPayload);
              break;
          }

          case 'getCollectionById': {
              const { collectionId, includeProducts = false, productCount = 10 } = toolClientArgs;
              if (typeof collectionId !== 'string') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.collectionId' of type string.`);
              if (typeof includeProducts !== 'boolean') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' argument 'includeProducts' must be a boolean.`);
              if (typeof productCount !== 'number') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' argument 'productCount' must be a number.`);

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
              graphQLPayload = {
                  query,
                  variables: { collectionId, productCount },
              };
              // --- Validate Query ---
              const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'storefront');
              if (!validationResult.valid) {
                   // Return INVALID_PARAMS if validation fails
                  return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
              }
              // --- Execute ---
              console.log(`Executing ${toolName} for ID: ${collectionId}`);
              proxyResult = await proxyStorefrontRequest(graphQLPayload);
              break;
          }

           case 'findCollections': {
              const { query: searchQuery, first = 10, after, sortKey = 'RELEVANCE', reverse = false } = toolClientArgs;
              // Basic validation
              if (searchQuery !== undefined && typeof searchQuery !== 'string') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' optional argument 'query' must be a string.`);
              if (typeof first !== 'number') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' argument 'first' must be a number.`);
              if (after !== undefined && typeof after !== 'string') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' optional argument 'after' must be a string.`);
              if (typeof sortKey !== 'string') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' argument 'sortKey' must be a string (CollectionSortKeys enum).`);
              if (typeof reverse !== 'boolean') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' argument 'reverse' must be a boolean.`);

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
              graphQLPayload = {
                  query,
                  variables: { first, after, query: searchQuery, sortKey, reverse },
              };
              // --- Validate Query ---
              const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'storefront');
              if (!validationResult.valid) {
                   // Return INVALID_PARAMS if validation fails
                  return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
              }
              // --- Execute ---
              console.log(`Executing ${toolName} with query: ${searchQuery}`);
              proxyResult = await proxyStorefrontRequest(graphQLPayload);
              break;
          }

          // --- Cart Mutations ---
          case 'cartCreate': {
              const { lines, buyerIdentity, attributes } = toolClientArgs;
              // Basic validation (can be more thorough)
              if (lines !== undefined && !Array.isArray(lines)) return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' optional argument 'lines' must be an array.`);
              // Add more validation for buyerIdentity, attributes if needed

              const mutation = `
                  mutation CartCreate($input: CartInput!) {
                    cartCreate(input: $input) {
                      cart { id checkoutUrl cost { totalAmount { amount currencyCode } } lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title product { title } } } } } } }
                      userErrors { field message }
                    }
                  }
              `;
              // Construct input object carefully
              const input: { lines?: unknown; buyerIdentity?: unknown; attributes?: unknown } = {};
              if (lines) input.lines = lines;
              if (buyerIdentity) input.buyerIdentity = buyerIdentity;
              if (attributes) input.attributes = attributes;

              graphQLPayload = { query: mutation, variables: { input } };
              // --- Validate Query ---
              const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'storefront');
              if (!validationResult.valid) {
                   // Return INVALID_PARAMS if validation fails
                  return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
              }
              // --- Execute ---
              console.log(`Executing ${toolName}`);
              proxyResult = await proxyStorefrontRequest(graphQLPayload);
              break;
          }

          case 'cartLinesAdd': {
              const { cartId, lines } = toolClientArgs;
              if (typeof cartId !== 'string') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.cartId' of type string.`);
              if (!Array.isArray(lines) || lines.length === 0) return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.lines' as a non-empty array.`);
              // Add validation for line item structure if needed

              const mutation = `
                  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
                    cartLinesAdd(cartId: $cartId, lines: $lines) {
                      cart { id checkoutUrl cost { totalAmount { amount currencyCode } } lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title product { title } } } } } } }
                      userErrors { field message }
                    }
                  }
              `;
              graphQLPayload = { query: mutation, variables: { cartId, lines } };
              // --- Validate Query ---
              const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'storefront');
              if (!validationResult.valid) {
                   // Return INVALID_PARAMS if validation fails
                  return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
              }
              // --- Execute ---
              console.log(`Executing ${toolName} for cart ID: ${cartId}`);
              proxyResult = await proxyStorefrontRequest(graphQLPayload);
              break;
          }

           case 'cartLinesUpdate': {
              const { cartId, lines } = toolClientArgs;
              if (typeof cartId !== 'string') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.cartId' of type string.`);
              if (!Array.isArray(lines) || lines.length === 0) return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.lines' as a non-empty array.`);
              // Add validation for line item structure (must contain id and quantity)

              const mutation = `
                  mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
                    cartLinesUpdate(cartId: $cartId, lines: $lines) {
                      cart { id checkoutUrl cost { totalAmount { amount currencyCode } } lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title product { title } } } } } } }
                      userErrors { field message }
                    }
                  }
              `;
              graphQLPayload = { query: mutation, variables: { cartId, lines } };
              // --- Validate Query ---
              const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'storefront');
              if (!validationResult.valid) {
                   // Return INVALID_PARAMS if validation fails
                  return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
              }
              // --- Execute ---
              console.log(`Executing ${toolName} for cart ID: ${cartId}`);
              proxyResult = await proxyStorefrontRequest(graphQLPayload);
              break;
          }

          case 'cartLinesRemove': {
              const { cartId, lineIds } = toolClientArgs;
               if (typeof cartId !== 'string') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.cartId' of type string.`);
              if (!Array.isArray(lineIds) || lineIds.length === 0 || !lineIds.every(id => typeof id === 'string')) {
                  return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.lineIds' as a non-empty array of strings.`);
              }

              const mutation = `
                  mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
                    cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
                      cart { id checkoutUrl cost { totalAmount { amount currencyCode } } lines(first: 50) { edges { node { id quantity merchandise { ... on ProductVariant { id title product { title } } } } } } }
                      userErrors { field message }
                    }
                  }
              `;
              graphQLPayload = { query: mutation, variables: { cartId, lineIds } };
              // --- Validate Query ---
              const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'storefront');
              if (!validationResult.valid) {
                   // Return INVALID_PARAMS if validation fails
                  return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
              }
              // --- Execute ---
              console.log(`Executing ${toolName} for cart ID: ${cartId}`);
              proxyResult = await proxyStorefrontRequest(graphQLPayload);
              break;
          }

          case 'getCart': {
              const { cartId } = toolClientArgs;
              if (typeof cartId !== 'string') {
                  return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.cartId' of type string.`);
              }
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
              graphQLPayload = { query, variables: { cartId } };
              // --- Validate Query ---
              const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'storefront');
              if (!validationResult.valid) {
                   // Return INVALID_PARAMS if validation fails
                  return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
              }
              // --- Execute ---
              console.log(`Executing ${toolName} for cart ID: ${cartId}`);
              proxyResult = await proxyStorefrontRequest(graphQLPayload);
              break;
          }

          // --- Admin Tools ---
          case 'getCustomerById': {
               if (!appConfig.adminApi.enabled) return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INTERNAL_ERROR, `Tool '${toolName}' requires Admin API, which is disabled.`);
               const { customerId } = toolClientArgs;
               if (typeof customerId !== 'string') return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.customerId' of type string.`);

               const query = `query GetCustomer($id: ID!) { customer(id: $id) { id email firstName lastName phone } }`;
               graphQLPayload = { query, variables: { id: customerId } };
               // --- Validate Query ---
               const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'admin');
               if (!validationResult.valid) {
                    // Return INVALID_PARAMS if validation fails
                   return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
               }
               // --- Execute ---
               console.log(`[AUDIT] Executing Admin tool: ${toolName} for ID: ${customerId}`); // Added Audit Log
               proxyResult = await proxyAdminRequest(graphQLPayload);
               proxyResult = await proxyAdminRequest(graphQLPayload);
               break;
          }

          case 'createProduct': {
               if (!appConfig.adminApi.enabled) return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INTERNAL_ERROR, `Tool '${toolName}' requires Admin API, which is disabled.`);
               const { input } = toolClientArgs;
               // Basic validation: input should be an object. Deeper validation against ProductInput schema is recommended.
               if (typeof input !== 'object' || input === null || Array.isArray(input)) {
                   return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.input' parameter of type object (ProductInput).`);
               }

               // Construct the mutation dynamically. Fields included here are basic examples.
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
               graphQLPayload = { query: mutation, variables: { input } };
               // --- Validate Query ---
               const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'admin');
               if (!validationResult.valid) {
                    // Return INVALID_PARAMS if validation fails
                   return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
               }
               // --- Execute ---
               console.log(`[AUDIT] Executing Admin tool: ${toolName}`); // Added Audit Log (Input details omitted for brevity/security)
               proxyResult = await proxyAdminRequest(graphQLPayload);
               proxyResult = await proxyAdminRequest(graphQLPayload);
               break;
          }

          case 'exampleAdminTool': {
            if (!appConfig.adminApi.enabled) {
              return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INTERNAL_ERROR, `Tool '${toolName}' requires Admin API, which is disabled.`);
            }
            if (typeof toolClientArgs.query !== 'string') {
               return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, `Tool '${toolName}' requires 'arguments.query' parameter of type string.`);
            }
            graphQLPayload = {
               query: toolClientArgs.query,
               variables: typeof toolClientArgs.variables === 'object' ? toolClientArgs.variables as Record<string, unknown> : undefined,
            };
            // --- Validate Query ---
            // Note: Validating client-provided query here
            const validationResult = await validateGraphQLQuery(graphQLPayload.query, 'admin');
            if (!validationResult.valid) {
                 // Return INVALID_PARAMS if validation fails
                return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INVALID_PARAMS, 'GraphQL query validation failed', validationResult.errors);
            }
            // --- Execute ---
            console.log(`[AUDIT] Executing Admin tool: ${toolName} with client-provided query`); // Added Audit Log
            proxyResult = await proxyAdminRequest(graphQLPayload);
            proxyResult = await proxyAdminRequest(graphQLPayload);
            break;
          }

          default:
            console.error(`MCP Tool not found: ${toolName}`);
            return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND, `Tool not found: ${toolName}`);
        }
        // --- End Tool Execution Switch ---

        // Check the result from the proxy function
        if (proxyResult.success) {
           return createJsonRpcSuccess(requestId, proxyResult.data);
        } else {
           // Forward the error structure from the proxy result
           // Define a minimal structure for expected errors
           interface ErrorResponse { errors?: [{ message?: string }] }
           const errorData = proxyResult.data as ErrorResponse;
           const message = errorData?.errors?.[0]?.message || 'Tool execution failed';
           // Use a generic internal error code, but pass Shopify's message if available
           return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INTERNAL_ERROR, message, proxyResult.data);
        }
      }
      default:
        console.warn(`MCP Method not found: ${jsonRpcRequest.method}`);
        return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${jsonRpcRequest.method}`);
    }
  } catch (error) {
     console.error(`MCP Endpoint: Internal error processing method ${jsonRpcRequest.method}:`, error);
     let message = 'Internal error';
     if (error instanceof Error) {
         message = error.message; // Be cautious about leaking internal details
     }
     return createJsonRpcError(requestId, JSON_RPC_ERROR_CODES.INTERNAL_ERROR, message);
  }
}

// MCP typically uses POST only
export async function GET(_request: NextRequest) {
  return NextResponse.json({ message: 'Method Not Allowed' }, { status: 405 });
}