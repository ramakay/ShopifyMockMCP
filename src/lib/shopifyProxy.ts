// Removed 'server-only' import
import { appConfig } from './config.js';
import { resolveStorefrontApiVersion, resolveAdminApiVersion } from './versionManager.js';

const MOCK_SHOP_URL = 'https://mock.shop/api'; // Assuming mock.shop uses /api path

interface GraphQLRequestBody {
  query: string;
  variables?: Record<string, unknown>;
}

interface ProxyResult {
  success: boolean;
  status: number;
  data: unknown; // Parsed JSON response or error object
}

/**
 * Executes a GraphQL request against the configured Storefront API endpoint (real or mock).
 * Handles URL construction, headers, and basic error handling.
 */
export async function proxyStorefrontRequest(body: GraphQLRequestBody): Promise<ProxyResult> {
  const { query, variables } = body;
  const apiVersion = await resolveStorefrontApiVersion(); // Now async
  let targetUrl: string;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (appConfig.shopify.isMockShop) {
    targetUrl = `${MOCK_SHOP_URL}/${apiVersion}/graphql.json`;
    console.error(`[${new Date().toISOString()}] INFO: Proxying Storefront request to mock.shop: ${targetUrl}`); // Changed to console.error
  } else if (appConfig.shopify.storeDomain && appConfig.shopify.storefrontAccessToken) {
    targetUrl = `https://${appConfig.shopify.storeDomain}/api/${apiVersion}/graphql.json`;
    headers['X-Shopify-Storefront-Access-Token'] = appConfig.shopify.storefrontAccessToken;
    console.error(`[${new Date().toISOString()}] INFO: Proxying Storefront request to real store: ${targetUrl}`); // Changed to console.error
  } else {
    console.error(`[${new Date().toISOString()}] ERROR: Storefront proxy configuration error: Real store configured but missing domain or token.`); // Added prefix
    return { success: false, status: 500, data: { errors: [{ message: 'Internal Server Configuration Error' }] } };
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ query, variables }),
      cache: 'no-store', // Default to no-store for API calls
    });

    const responseData = await response.json();
    return { success: response.ok, status: response.status, data: responseData };

  } catch (error) {
    let message = 'Failed to proxy request to Shopify Storefront API.';
    if (error instanceof Error) message += ` ${error.message}`;
    console.error(`[${new Date().toISOString()}] ERROR: Error in proxyStorefrontRequest: ${message}`, error); // Added prefix
    return { success: false, status: 502, data: { errors: [{ message }] } };
  }
}

/**
 * Executes a GraphQL request against the configured Admin API endpoint.
 * Handles URL construction, headers, and basic error handling.
 * Throws an error if Admin API is not configured/enabled.
 */
export async function proxyAdminRequest(body: GraphQLRequestBody): Promise<ProxyResult> {
   const { query, variables } = body;

   // --- Security Check ---
   if (!appConfig.adminApi.enabled) {
     console.error(`[${new Date().toISOString()}] ERROR: Admin proxy request failed: Admin API access is disabled.`); // Added prefix
     return { success: false, status: 403, data: { errors: [{ message: 'Admin API access is disabled.' }] } }; // Forbidden
   }
   if (!appConfig.adminApi.adminAccessToken || !appConfig.shopify.storeDomain) {
      console.error(`[${new Date().toISOString()}] ERROR: Admin proxy request failed: Admin API enabled but missing token or store domain.`); // Added prefix
      return { success: false, status: 500, data: { errors: [{ message: 'Admin API configuration error: Missing token or store domain.' }] } };
   }
   // --- End Check ---

   const apiVersion = await resolveAdminApiVersion(); // Now async
   if (!apiVersion) {
       // This indicates a failure in fetching/resolving the version via publicApiVersions
       console.error(`[${new Date().toISOString()}] ERROR: Admin proxy request failed: Could not resolve Admin API version.`); // Added prefix
       return { success: false, status: 500, data: { errors: [{ message: 'Internal Server Error: Could not resolve Admin API version.' }] } };
   }

   const targetUrl = `https://${appConfig.shopify.storeDomain}/admin/api/${apiVersion}/graphql.json`;
   const headers: HeadersInit = {
     'Content-Type': 'application/json',
     'X-Shopify-Access-Token': appConfig.adminApi.adminAccessToken,
   };

   // Attempt to extract operation name for logging (basic regex, might not cover all cases)
   const operationMatch = query.match(/(?:query|mutation)\s*(\w+)/);
   const operationName = operationMatch ? operationMatch[1] : 'UnknownOperation';

   // Audit Log: Log the attempt to call the Admin API
   console.error(`[${new Date().toISOString()}] AUDIT: Proxying Admin request: Operation=${operationName}, Target=${targetUrl}`); // Changed to console.error
   // IMPORTANT: Do NOT log variables here as they might contain sensitive data.

   try {
     const response = await fetch(targetUrl, {
       method: 'POST',
       headers: headers,
       body: JSON.stringify({ query, variables }),
       cache: 'no-store',
     });

     const responseData = await response.json();
     return { success: response.ok, status: response.status, data: responseData };

   } catch (error) {
     let message = 'Failed to proxy request to Shopify Admin API.';
     if (error instanceof Error) message += ` ${error.message}`;
     console.error(`[${new Date().toISOString()}] ERROR: Error in proxyAdminRequest: ${message}`, error); // Added prefix
     // Return error structure consistent with ProxyResult
     return { success: false, status: 502, data: { errors: [{ message: 'Failed to communicate with Shopify Admin API.' }] } };
   }
}