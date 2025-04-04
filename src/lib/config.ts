// Removed 'server-only' import as this is now a standalone Node script

// Define the structure of our application configuration
export interface AppConfig {
  shopify: {
    storeDomain: string | null; // e.g., 'your-store.myshopify.com' or null for mock.shop
    storefrontApiVersion: string | null; // e.g., '2025-01' or null for latest stable
    storefrontAccessToken: string | null; // Public token, required for real store
    isMockShop: boolean;
  };
  adminApi: {
    enabled: boolean;
    adminApiVersion: string | null; // e.g., '2025-01' or null for latest stable
    adminAccessToken: string | null; // Private token, required if enabled
  };
}

// Function to load and validate configuration from environment variables
function loadConfig(): AppConfig {
  const shopifyStore = process.env.SHOPIFY_STORE?.trim() || null;
  const storefrontAccessToken = process.env.SHOPIFY_ACCESS_TOKEN?.trim() || null;
  const storefrontApiVersion = process.env.SHOPIFY_VERSION?.trim() || null;

  const useAdminApiEnv = process.env.USE_ADMIN_API?.toLowerCase()?.trim();
  const isAdminApiEnabled = useAdminApiEnv === 'true' || useAdminApiEnv === '1';
  const adminAccessToken = process.env.ADMIN_ACCESS_TOKEN?.trim() || null;
  const adminApiVersion = process.env.ADMIN_VERSION?.trim() || null;

  const isMockShop = !shopifyStore;

  // Basic Validation
  if (!isMockShop && !storefrontAccessToken) {
    console.error( // Changed from console.warn
      'WARNING: SHOPIFY_STORE is set, but SHOPIFY_ACCESS_TOKEN is missing. Storefront API calls to the real store will likely fail.',
    );
    // We don't throw here, allowing potential use of mock.shop fallback logic later
  }

  if (isAdminApiEnabled && !adminAccessToken) {
    // This is a critical configuration error if Admin API is intended to be used
    throw new Error(
      'Configuration Error: USE_ADMIN_API is true, but ADMIN_ACCESS_TOKEN is missing.',
    );
  }
   if (isAdminApiEnabled && !shopifyStore) {
    // Admin API requires a real store context
    throw new Error(
      'Configuration Error: USE_ADMIN_API is true, but SHOPIFY_STORE is not configured. Admin API requires a real store.',
    );
  }


  const config: AppConfig = {
    shopify: {
      storeDomain: shopifyStore,
      storefrontApiVersion: storefrontApiVersion,
      storefrontAccessToken: storefrontAccessToken,
      isMockShop: isMockShop,
    },
    adminApi: {
      enabled: isAdminApiEnabled,
      adminApiVersion: adminApiVersion,
      adminAccessToken: adminAccessToken,
    },
  };

  return config;
}

// Load the configuration once when the module is imported
export const appConfig = loadConfig();

// Log mock shop status on server startup (for visibility during development)
if (typeof window === 'undefined') { // Ensure this only runs server-side
  console.error(`[${new Date().toISOString()}] INFO: Shopify Integration: ${appConfig.shopify.isMockShop ? 'Using mock.shop' : `Configured for ${appConfig.shopify.storeDomain}`}`); // Changed to console.error and added prefix
  console.error(`[${new Date().toISOString()}] INFO: Admin API: ${appConfig.adminApi.enabled ? 'Enabled' : 'Disabled'}`); // Changed to console.error and added prefix
}