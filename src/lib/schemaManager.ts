// Removed 'server-only' import
import fs from 'fs/promises';
import path from 'path';
import { appConfig } from './config.js';
// Removed proxy imports as performIntrospection will use direct fetch
import { resolveStorefrontApiVersion, resolveAdminApiVersion } from './versionManager.js'; // Need version resolution
import { getIntrospectionQuery, buildClientSchema, printSchema, IntrospectionQuery } from 'graphql';

// --- Constants ---
const SCHEMA_DIR = path.join(process.cwd(), 'src', 'lib', 'schemas'); // Assuming cwd is 'app' directory
// Removed constant paths, will construct dynamically based on version
const INTROSPECTION_QUERY = getIntrospectionQuery({ descriptions: true }); // Get standard introspection query

// --- Cache (In-memory for read content) ---
let storefrontSchemaCache: string | null = null;
let adminSchemaCache: string | null = null;

// --- Helper Functions ---

/**
 * Checks if a file exists.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Performs GraphQL introspection against the specified API type.
 * @param apiType 'storefront' or 'admin'
 * @returns Promise<IntrospectionQuery | null> The introspection result or null on error.
 */
async function performIntrospection(apiType: 'storefront' | 'admin'): Promise<IntrospectionQuery | null> {
    console.error(`[${new Date().toISOString()}] INFO: Performing ${apiType} GraphQL introspection directly...`); // Changed to console.error

    let endpointUrl: string;
    const headers: HeadersInit = { // Changed let to const
        'Content-Type': 'application/json',
    };
    let apiVersion: string | null;

    // Determine endpoint, headers, and resolved version based on apiType and config
    if (apiType === 'storefront') {
        apiVersion = await resolveStorefrontApiVersion(); // Get resolved version
        if (appConfig.shopify.isMockShop) {
            endpointUrl = `https://mock.shop/api/${apiVersion}/graphql.json`;
        } else if (appConfig.shopify.storeDomain && appConfig.shopify.storefrontAccessToken) {
            endpointUrl = `https://${appConfig.shopify.storeDomain}/api/${apiVersion}/graphql.json`;
            headers['X-Shopify-Storefront-Access-Token'] = appConfig.shopify.storefrontAccessToken;
        } else {
             console.error(`[${new Date().toISOString()}] ERROR: Storefront API configuration missing for introspection.`); // Added prefix
             return null;
        }
    } else { // apiType === 'admin'
        if (!appConfig.adminApi.enabled) {
             console.error(`[${new Date().toISOString()}] INFO: Admin API disabled, skipping introspection.`); // Changed to console.error
             return null;
        }
        apiVersion = await resolveAdminApiVersion(); // Get resolved version
        if (!apiVersion) {
             console.error(`[${new Date().toISOString()}] ERROR: Could not resolve Admin API version for introspection.`); // Added prefix
             return null;
        }
        if (!appConfig.shopify.storeDomain || !appConfig.adminApi.adminAccessToken) {
            console.error(`[${new Date().toISOString()}] ERROR: Admin API configuration missing for introspection.`); // Added prefix
            return null;
        }
        endpointUrl = `https://${appConfig.shopify.storeDomain}/admin/api/${apiVersion}/graphql.json`;
        headers['X-Shopify-Admin-API-Access-Token'] = appConfig.adminApi.adminAccessToken;
    }

    console.error(`[${new Date().toISOString()}] INFO: Directly introspecting ${apiType} from: ${endpointUrl}`); // Changed to console.error

    try {
        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ query: INTROSPECTION_QUERY }),
            cache: 'no-store', // Ensure fresh data for introspection
        });

        if (!response.ok) {
            console.error(`[${new Date().toISOString()}] ERROR: Error during ${apiType} introspection: HTTP status ${response.status}`, await response.text()); // Added prefix
            return null;
        }

        const responseData = await response.json();

        // Check for GraphQL errors in the response
        if (responseData.errors) {
             console.error(`[${new Date().toISOString()}] ERROR: Error during ${apiType} introspection: GraphQL errors received`, responseData.errors); // Added prefix
             return null;
        }

        // Check for the introspection result structure
        if (responseData.data && typeof responseData.data === 'object' && '__schema' in responseData.data) {
            console.error(`[${new Date().toISOString()}] INFO: Successfully performed ${apiType} introspection.`); // Changed to console.error
            return responseData.data as IntrospectionQuery;
        } else {
            console.error(`[${new Date().toISOString()}] ERROR: Error during ${apiType} introspection: Invalid response structure`, responseData); // Added prefix
        }
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ERROR: Error during direct fetch for ${apiType} introspection:`, error); // Added prefix
    }
    return null;
}

/**
 * Ensures the schema directory exists.
 */
async function ensureSchemaDirectory(): Promise<void> {
    try {
        await fs.mkdir(SCHEMA_DIR, { recursive: true });
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ERROR: Failed to create schema directory: ${SCHEMA_DIR}`, error); // Added prefix
        throw new Error(`Failed to create schema directory: ${SCHEMA_DIR}`);
    }
}

/**
 * Introspects the relevant API, builds the schema, prints it, and saves it to the specified file path.
 * @param apiType 'storefront' or 'admin'
 * @param filePath The path to save the schema file.
 * @returns Promise<boolean> True if successful, false otherwise.
 */
async function introspectAndSaveSchema(apiType: 'storefront' | 'admin', filePath: string): Promise<boolean> {
  const introspectionResult = await performIntrospection(apiType);
  if (!introspectionResult) {
    console.error(`[${new Date().toISOString()}] ERROR: Introspection failed for ${apiType} API.`); // Added prefix
    return false;
  }

  try {
    const schema = buildClientSchema(introspectionResult);
    const schemaString = printSchema(schema);

    await ensureSchemaDirectory(); // Make sure directory exists before writing
    await fs.writeFile(filePath, schemaString, 'utf-8');
    console.error(`[${new Date().toISOString()}] INFO: ${apiType} schema saved successfully to ${filePath}`); // Changed to console.error
    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR: Error building or saving ${apiType} schema to ${filePath}:`, error); // Added prefix
    return false;
  }
}

// --- Exported Functions ---

/**
 * Reads the Storefront GraphQL schema.
 * If the schema file doesn't exist, it triggers introspection to create it.
 * Caches the result in memory after the first successful read.
 *
 * @returns {Promise<string>} The Storefront schema content.
 * @throws {Error} If the schema file cannot be read or generated.
 */
export async function getStorefrontSchema(): Promise<string> {
    // 1. Resolve version
    const apiVersion = await resolveStorefrontApiVersion();
    const versionedSchemaPath = path.join(SCHEMA_DIR, `schema-storefront-${apiVersion}.graphql`);
    console.log(`Attempting to load Storefront schema for version ${apiVersion} from ${versionedSchemaPath}`);

    // Use cache if available for this specific version (simple cache implementation)
    // Note: A more robust cache might key by version, but for now, just cache the last loaded one.
    if (storefrontSchemaCache) {
        console.error(`[${new Date().toISOString()}] INFO: Returning cached Storefront schema.`); // Changed to console.error
        return storefrontSchemaCache;
    }

    // 2. Check if version-specific file exists
    if (!(await fileExists(versionedSchemaPath))) {
        console.error(`[${new Date().toISOString()}] INFO: Versioned Storefront schema file not found. Triggering introspection for ${apiVersion}...`); // Changed to console.error
        // 3. Introspect and save if file doesn't exist
        const success = await introspectAndSaveSchema('storefront', versionedSchemaPath);
        if (!success) {
            throw new Error(`Failed to generate Storefront schema version ${apiVersion} via introspection.`);
        }
        // Invalidate cache after introspection
        storefrontSchemaCache = null;
    }

    // 4. Read the file (either pre-existing or newly generated)
    try {
        console.error(`[${new Date().toISOString()}] INFO: Reading Storefront schema from: ${versionedSchemaPath}`); // Changed to console.error
        const schemaContent = await fs.readFile(versionedSchemaPath, 'utf-8');
        storefrontSchemaCache = schemaContent; // Cache the content
        return schemaContent;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ERROR: Error reading Storefront schema file (${versionedSchemaPath}):`, error); // Added prefix
        storefrontSchemaCache = null; // Clear cache on error
        throw new Error(`Failed to load Storefront schema version ${apiVersion} from ${versionedSchemaPath}.`);
    }
}

/**
 * Reads the Admin GraphQL schema if Admin API is enabled.
 * If the schema file doesn't exist, it triggers introspection to create it.
 * Returns null if Admin API is not enabled.
 * Caches the result in memory after the first successful read.
 *
 * @returns {Promise<string | null>} The Admin schema content or null.
 * @throws {Error} If the schema file cannot be read or generated when Admin API is enabled.
 */
export async function getAdminSchema(): Promise<string | null> {
    if (!appConfig.adminApi.enabled) {
        return null; // Admin API not enabled
    }

    // 1. Resolve version
    const apiVersion = await resolveAdminApiVersion();
    if (!apiVersion) {
        console.error(`[${new Date().toISOString()}] WARN: Could not resolve Admin API version. Cannot load Admin schema.`); // Changed to console.error
        return null; // Cannot proceed without a version
    }
    const versionedSchemaPath = path.join(SCHEMA_DIR, `schema-admin-${apiVersion}.graphql`);
    console.log(`Attempting to load Admin schema for version ${apiVersion} from ${versionedSchemaPath}`);

    // Use cache if available (simple cache implementation)
    if (adminSchemaCache) {
         console.error(`[${new Date().toISOString()}] INFO: Returning cached Admin schema.`); // Changed to console.error
        return adminSchemaCache;
    }

    // 2. Check if version-specific file exists
    if (!(await fileExists(versionedSchemaPath))) {
        console.error(`[${new Date().toISOString()}] INFO: Versioned Admin schema file not found. Triggering introspection for ${apiVersion}...`); // Changed to console.error
         // 3. Introspect and save if file doesn't exist
        const success = await introspectAndSaveSchema('admin', versionedSchemaPath);
        if (!success) {
            // Don't throw, but return null as admin schema might be optional for some operations
            console.error(`[${new Date().toISOString()}] ERROR: Failed to generate Admin schema version ${apiVersion} via introspection.`); // Added prefix
            return null;
        }
         // Invalidate cache after introspection
        adminSchemaCache = null;
    }

    // 4. Read the file (either pre-existing or newly generated)
    try {
        console.error(`[${new Date().toISOString()}] INFO: Reading Admin schema from: ${versionedSchemaPath}`); // Changed to console.error
        const schemaContent = await fs.readFile(versionedSchemaPath, 'utf-8');
        adminSchemaCache = schemaContent; // Cache the content
        return schemaContent;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] ERROR: Error reading Admin schema file (${versionedSchemaPath}):`, error); // Added prefix
        adminSchemaCache = null; // Clear cache on error
         // Don't throw, but return null as admin schema might be optional
        return null;
    }
}