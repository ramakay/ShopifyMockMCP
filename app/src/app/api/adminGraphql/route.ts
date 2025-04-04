import { NextRequest, NextResponse } from 'next/server';
import { appConfig } from '@/lib/config';
import { proxyAdminRequest } from '@/lib/shopifyProxy';

/**
 * Handles POST requests to the Admin GraphQL proxy endpoint.
 * Forwards the request ONLY if the Admin API is enabled and configured.
 */
export async function POST(request: NextRequest) {
  // --- Security Check: Ensure Admin API is enabled and configured ---
  if (!appConfig.adminApi.enabled) {
    return NextResponse.json({ errors: [{ message: 'Admin API access is disabled.' }] }, { status: 403 }); // Forbidden
  }
  // Config loader should have already thrown if enabled but token/store is missing, but double-check token
  if (!appConfig.adminApi.adminAccessToken || !appConfig.shopify.storeDomain) {
     console.error('Admin proxy configuration error: Admin API enabled but missing token or store domain.');
     return NextResponse.json({ errors: [{ message: 'Internal Server Configuration Error' }] }, { status: 500 });
  }
  // --- End Security Check ---

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    console.error('Error parsing request body:', error);
    return NextResponse.json({ errors: [{ message: 'Invalid JSON body' }] }, { status: 400 });
  }

  const { query, variables } = requestBody;

  if (!query) {
    return NextResponse.json({ errors: [{ message: 'Missing GraphQL query in request body' }] }, { status: 400 });
  }

  try {
    // Use the refactored proxy function
    // It handles the internal checks for version, token, etc. and throws if invalid
    const result = await proxyAdminRequest({ query, variables });

    // Return the result from the proxy function
    return NextResponse.json(result.data, { status: result.status });

  } catch (error) {
    // Catch errors thrown by proxyAdminRequest (e.g., config errors) or fetch errors within it
    let message = 'Failed to process Admin API request.';
    let status = 500; // Default internal error

    if (error instanceof Error) {
      // Provide slightly more context for known configuration issues if safe
      if (error.message.includes('disabled') || error.message.includes('missing token')) {
        message = error.message; // Pass config errors through
        status = 403; // Forbidden or Bad Request might be appropriate
      } else {
         // Keep generic for other errors from proxyAdminRequest
         message = 'Failed to communicate with Shopify Admin API.';
         status = 502; // Bad Gateway for fetch/network issues
      }
       console.error('Error in Admin API proxy route:', error.message);
    } else {
       console.error('Unknown error in Admin API proxy route:', error);
    }

    return NextResponse.json({ errors: [{ message }] }, { status });
  }
}

// Optional: Handle GET requests if needed
// export async function GET(request: NextRequest) {
//   if (!appConfig.adminApi.enabled) {
//     return NextResponse.json({ errors: [{ message: 'Admin API access is disabled.' }] }, { status: 403 });
//   }
//   // Handle GET appropriately if required
//   return NextResponse.json({ message: 'GET method not typically used for GraphQL mutations/queries' }, { status: 405 });
// }