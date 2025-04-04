// Removed 'server-only' import
import { appConfig } from './config.js';
// Removed proxy imports as fetchPublicApiVersions will use direct fetch

// --- Constants ---
const PUBLIC_API_VERSIONS_QUERY = `query PublicApiVersions { publicApiVersions { handle displayName supported } }`;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache

// --- Types ---
interface ApiVersionInfo {
  handle: string; // e.g., "2025-01"
  displayName: string; // e.g., "2025-01"
  supported: boolean; // Indicates if the version is currently supported
}

interface PublicApiVersionsResponse {
  data?: {
    publicApiVersions: ApiVersionInfo[];
  };
  errors?: unknown[];
}

interface VersionCacheEntry {
  versions: ApiVersionInfo[];
  timestamp: number;
}

// --- Cache ---
let storefrontVersionCache: VersionCacheEntry | null = null;
let adminVersionCache: VersionCacheEntry | null = null;

// --- Helper Functions ---

/**
 * Fetches public API versions from the appropriate Shopify endpoint.
 * Handles caching.
 * @param apiType 'storefront' or 'admin'
 * @returns Promise<ApiVersionInfo[] | null> List of versions or null on error.
 */
async function fetchPublicApiVersions(apiType: 'storefront' | 'admin'): Promise<ApiVersionInfo[] | null> {
    const now = Date.now();
    const cache = apiType === 'storefront' ? storefrontVersionCache : adminVersionCache;

    // Check cache first
    if (cache && (now - cache.timestamp < CACHE_DURATION_MS)) {
        console.error(`[${new Date().toISOString()}] INFO: Using cached ${apiType} API versions.`); // Changed to console.error
        return cache.versions;
    }

    console.error(`[${new Date().toISOString()}] INFO: Fetching ${apiType} publicApiVersions directly...`); // Changed to console.error

    let endpointUrl: string;
    const headers: HeadersInit = { // Changed let to const
        'Content-Type': 'application/json',
    };

    // Determine endpoint and headers based on apiType and config
    if (apiType === 'storefront') {
        if (appConfig.shopify.storeDomain && appConfig.shopify.storefrontAccessToken) {
            // Use real store URL - use a base version like 'unstable' or a known recent one for this specific query
            // as we are *fetching* the available versions. The exact version doesn't matter much here.
            const baseVersionForQuery = appConfig.shopify.storefrontApiVersion || 'unstable';
            endpointUrl = `https://${appConfig.shopify.storeDomain}/api/${baseVersionForQuery}/graphql.json`;
            headers['X-Shopify-Storefront-Access-Token'] = appConfig.shopify.storefrontAccessToken;
        } else {
            // Fallback to mock.shop
            endpointUrl = 'https://mock.shop/api/unstable/graphql.json'; // Use hardcoded mock.shop URL
        }
    } else { // apiType === 'admin'
        // Use shopify.storeDomain for Admin API endpoint construction
        if (!appConfig.adminApi.enabled || !appConfig.shopify.storeDomain || !appConfig.adminApi.adminAccessToken) {
            console.error(`[${new Date().toISOString()}] INFO: Admin API not configured or enabled. Cannot fetch admin versions.`); // Changed to console.error
            return null; // Cannot fetch admin versions if not configured
        }
        // Use a base version like 'unstable' or configured one for the query
        const baseVersionForQuery = appConfig.adminApi.adminApiVersion || 'unstable';
        // Use shopify.storeDomain for Admin API endpoint construction
        endpointUrl = `https://${appConfig.shopify.storeDomain}/admin/api/${baseVersionForQuery}/graphql.json`;
        headers['X-Shopify-Admin-API-Access-Token'] = appConfig.adminApi.adminAccessToken; // Correct header for Admin API
    }

    try {
        console.error(`[${new Date().toISOString()}] INFO: Directly fetching ${apiType} versions from: ${endpointUrl}`); // Changed to console.error
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ query: PUBLIC_API_VERSIONS_QUERY }),
            cache: 'no-store', // Ensure fresh data for version checks
        });

        if (!response.ok) {
            console.error(`[${new Date().toISOString()}] ERROR: Error fetching ${apiType} publicApiVersions: HTTP status ${response.status}`, await response.text()); // Added prefix
            return null;
        }

        const responseData = await response.json() as PublicApiVersionsResponse;

        if (responseData.data?.publicApiVersions) {
            const versions = responseData.data.publicApiVersions;
            // Update cache
            const newCacheEntry = { versions, timestamp: now };
            if (apiType === 'storefront') {
                storefrontVersionCache = newCacheEntry;
            } else {
                adminVersionCache = newCacheEntry;
            }
            console.error(`[${new Date().toISOString()}] INFO: Successfully fetched and cached ${apiType} API versions.`); // Changed to console.error
            return versions;
        } else {
            console.error(`[${new Date().toISOString()}] ERROR: Error fetching ${apiType} publicApiVersions: Invalid response structure`, responseData); // Added prefix
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ERROR: Error during direct fetch for ${apiType} publicApiVersions:`, error); // Added prefix
    }

    return null; // Return null if fetch or parsing failed
}

/**
 * Finds the latest stable (supported) version from a list of API versions.
 * Assumes versions are sortable strings (YYYY-MM).
 * @param versions List of ApiVersionInfo
 * @returns The handle of the latest stable version, or null if none found.
 */
function findLatestStableVersion(versions: ApiVersionInfo[] | null): string | null {
  if (!versions) return null;

  const stableVersions = versions
    .filter(v => v.supported)
    .sort((a, b) => b.handle.localeCompare(a.handle)); // Sort descending

  // Check if stableVersions[0] exists before accessing its handle property
  return stableVersions.length > 0 && stableVersions[0] ? stableVersions[0].handle : null;
}

// --- Exported Functions ---

/**
 * Determines the target Storefront API version to use.
 * 1. Fetches supported versions from Shopify (uses cache).
 * 2. Validates the configured version (`SHOPIFY_VERSION`).
 * 3. If valid and supported, uses it.
 * 4. Otherwise, falls back to the latest stable version.
 * 5. Returns a hardcoded default if fetching/fallback fails.
 *
 * @returns {Promise<string>} The resolved API version string (e.g., "2025-01").
 */
export async function resolveStorefrontApiVersion(): Promise<string> {
  const configuredVersion = appConfig.shopify.storefrontApiVersion;
  const publicVersions = await fetchPublicApiVersions('storefront');
  const latestStable = findLatestStableVersion(publicVersions);

  if (configuredVersion && publicVersions?.some(v => v.handle === configuredVersion && v.supported)) {
    console.error(`[${new Date().toISOString()}] INFO: Using configured and supported Storefront API version: ${configuredVersion}`); // Changed to console.error
    return configuredVersion;
  }

  if (configuredVersion) {
     console.error(`[${new Date().toISOString()}] WARN: Configured Storefront API version "${configuredVersion}" is invalid or unsupported.`); // Changed to console.error
  }

  if (latestStable) {
    console.error(`[${new Date().toISOString()}] INFO: Using latest stable Storefront API version: ${latestStable}`); // Changed to console.error
    return latestStable;
  }

  // Fallback if everything else fails
  const fallbackVersion = '2024-07'; // Use a known recent, likely stable version as ultimate fallback
  console.error(`[${new Date().toISOString()}] WARN: Could not determine latest stable Storefront API version. Using fallback: ${fallbackVersion}`); // Changed to console.error
  return fallbackVersion;
}

/**
 * Determines the target Admin API version to use.
 * Only relevant if the Admin API is enabled.
 * Logic mirrors resolveStorefrontApiVersion but for the Admin API.
 *
 * @returns {Promise<string | null>} The resolved API version string or null if Admin API is disabled or resolution fails.
 */
export async function resolveAdminApiVersion(): Promise<string | null> {
  if (!appConfig.adminApi.enabled) {
    return null; // Admin API not enabled
  }

  const configuredVersion = appConfig.adminApi.adminApiVersion;
  const publicVersions = await fetchPublicApiVersions('admin'); // Fetches specifically for Admin API context
  const latestStable = findLatestStableVersion(publicVersions);

  if (configuredVersion && publicVersions?.some(v => v.handle === configuredVersion && v.supported)) {
    console.error(`[${new Date().toISOString()}] INFO: Using configured and supported Admin API version: ${configuredVersion}`); // Changed to console.error
    return configuredVersion;
  }

   if (configuredVersion) {
     console.error(`[${new Date().toISOString()}] WARN: Configured Admin API version "${configuredVersion}" is invalid or unsupported.`); // Changed to console.error
  }

  if (latestStable) {
    console.error(`[${new Date().toISOString()}] INFO: Using latest stable Admin API version: ${latestStable}`); // Changed to console.error
    return latestStable;
  }

  // Fallback for Admin API - returning null might be safer than guessing
  console.error(`[${new Date().toISOString()}] WARN: Could not determine latest stable Admin API version. Admin API calls might fail if version is required.`); // Changed to console.error
  return null; // Or return a hardcoded fallback like storefront? Returning null seems safer.
}

// --- Deprecate or Update Old Functions ---
// The original synchronous functions are no longer suitable as version resolution is now async.
// We need to update the places where they were used (proxies, MCP initialize)
// to call the new async resolve* functions.

/*
// OLD synchronous functions - replace usage with async resolve* functions
export function getStorefrontApiVersion(): string { ... }
export function getAdminApiVersion(): string | null { ... }
*/