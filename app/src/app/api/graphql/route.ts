import { NextRequest, NextResponse } from 'next/server';
import { proxyStorefrontRequest } from '@/lib/shopifyProxy';

/**
 * Handles POST requests to the Storefront GraphQL proxy endpoint.
 * Forwards the request to the configured Shopify store or mock.shop.
 */
export async function POST(request: NextRequest) {
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

  // Use the refactored proxy function
  const result = await proxyStorefrontRequest({ query, variables });

  // Return the result from the proxy function, which includes status and data
  return NextResponse.json(result.data, { status: result.status });
}

// Optional: Handle GET requests if needed, though GraphQL typically uses POST
// export async function GET(request: NextRequest) {
//   // Similar logic, potentially for introspection queries via URL params?
//   return NextResponse.json({ message: 'GET method not typically used for GraphQL mutations/queries' }, { status: 405 });
// }