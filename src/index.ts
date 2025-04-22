#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Axios from "axios";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_CONFIG_FILE = path.resolve(
  path.dirname(__dirname),
  "config/api_configs.json"
);

const server = new McpServer({
  name: "Request",
  version: "1.0.0",
});

const API_CONFIGS = new Map();

// Initialize default API configurations
const defaultApis = [
  {
    id: "crypto_price",
    name: "Cryptocurrency Price Query",
    description: "Query current cryptocurrency prices from CoinGecko API",
    // users input params
    params: {
      ids: {
        type: "string",
        description:
          "Comma-separated cryptocurrency IDs (e.g., bitcoin,ethereum)",
        example: "bitcoin,ethereum",
      },
      vs_currencies: {
        type: "string",
        description:
          "Comma-separated currency codes for price conversion (e.g., usd,eur)",
        example: "usd",
      },
    },
    api: {
      url: "https://api.coingecko.com/api/v3/simple/price",
      method: "GET",
      headers: {},
      // default params
      params: {
        include_24hr_change: true,
      },
    },
  },
  {
    id: "myip",
    name: "Get my device's IP",
    description:
      "Get my device's IP, output include ip, city, region, country, loc, org, postal, timezone",
    api: {
      url: "https://ipinfo.io/json",
      method: "GET",
    },
  },
  {
    id: "getIpLocation",
    name: "get IP's location",
    description:
      "get IP's location, output include ip, city, region, country, loc, org, postal, timezone",
    params: {
      ip: {
        type: "string",
        description: "IP address",
        example: "8.8.8.8",
      },
    },
    api: {
      // support placeholder {ip}
      url: "https://ipinfo.io/{ip}/json",
      method: "GET",
    },
  },
];

// Load saved API configurations
async function loadApiConfigs() {
  try {
    // Ensure config directory exists
    const configDir = path.dirname(API_CONFIG_FILE);
    await fs.mkdir(configDir, { recursive: true });

    // First load default configurations
    API_CONFIGS.clear();
    defaultApis.forEach((api) => {
      API_CONFIGS.set(api.id, api);
    });

    try {
      // Try to read config file
      const data = await fs.readFile(API_CONFIG_FILE, "utf-8");
      const savedConfigs = JSON.parse(data);

      // Merge saved configurations, local config has higher priority than default config
      Object.entries(savedConfigs).forEach(([id, config]) => {
        API_CONFIGS.set(id, config);
      });
    } catch (error) {
      // If file doesn't exist or other error, just use default configs
      console.log("Using default API configurations");
    }

    // Save final configurations
    await saveApiConfigs();
  } catch (error) {
    console.error("Error loading API configurations:", error);
    // Use default configurations as fallback
    API_CONFIGS.clear();
    defaultApis.forEach((api) => {
      API_CONFIGS.set(api.id, api);
    });
  }
}

// Save API configurations to file
async function saveApiConfigs() {
  try {
    // Ensure config directory exists
    const configDir = path.dirname(API_CONFIG_FILE);
    await fs.mkdir(configDir, { recursive: true });

    const configs = Object.fromEntries(API_CONFIGS);
    await fs.writeFile(API_CONFIG_FILE, JSON.stringify(configs, null, 2));
  } catch (error) {
    console.error("Failed to save API configurations:", error);
  }
}

// Add tool for registering custom API
server.tool(
  "registerApi",
  "Register a new custom API. Complete API configuration information is required, including id, name, description, params, and api configuration.",
  {
    config: z.string().describe("API configuration JSON string"),
  },
  async ({ config }) => {
    try {
      const apiConfig = JSON.parse(config);

      // Validate required fields
      if (
        !apiConfig.id ||
        !apiConfig.name ||
        !apiConfig.description ||
        !apiConfig.api
      ) {
        return {
          content: [
            { type: "text", text: "API configuration missing required fields" },
          ],
        };
      }

      // Check if ID already exists
      if (API_CONFIGS.has(apiConfig.id)) {
        return {
          content: [
            { type: "text", text: `API ID ${apiConfig.id} already exists` },
          ],
        };
      }

      // Add new API configuration
      API_CONFIGS.set(apiConfig.id, apiConfig);

      // Save to file
      await saveApiConfigs();

      return {
        content: [
          {
            type: "text",
            text: `Successfully registered API: ${apiConfig.name}`,
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          { type: "text", text: `Failed to register API: ${errorMessage}` },
        ],
      };
    }
  }
);

// Add tool for deleting API
server.tool(
  "deleteApi",
  "Delete a registered API.",
  {
    id: z.string().describe("ID of the API to delete"),
  },
  async ({ id }) => {
    try {
      if (!API_CONFIGS.has(id)) {
        return {
          content: [{ type: "text", text: `API ${id} does not exist` }],
        };
      }

      // Delete API
      API_CONFIGS.delete(id);

      // Save to file
      await saveApiConfigs();

      return {
        content: [{ type: "text", text: `Successfully deleted API: ${id}` }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          { type: "text", text: `Failed to delete API: ${errorMessage}` },
        ],
      };
    }
  }
);

// before any request
server.tool(
  "beforeRequest",
  `Before querying any data, this tool first retrieves a 
    list of available APIs that can be directly invoked. 
    It returns a list of interface definitions. 
    Based on the user's request match the appropriate API, 
    prompts the user to complete the required input parameters, 
    and then uses the request tool to make the call.
    The first argument to request tool is the id field of the selected API from the list,
    and complete other parameters that defined in the params field of the API using 
    a JSON string type as the second argument.`,
  async () => {
    try {
      const apiList = Array.from(API_CONFIGS.values()).map((config) => ({
        id: config.id,
        name: config.name,
        description: config.description,
        params: config.params,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(apiList, null, 2) }],
      };
    } catch (error: any) {
      console.error("Error in requestList:", error);
      return {
        content: [
          { type: "text", text: `Failed to get API list: ${error.message}` },
        ],
      };
    }
  }
);

// Modify request tool to use Map
server.tool(
  "request",
  "This is a general tool for sending requests. It takes 2 parameters: the first is the id of the API to call, and the second is the parameters required for the API request",
  {
    id: z.string(),
    args: z.string(),
  },
  async ({ id, args }) => {
    try {
      const apiConfig = API_CONFIGS.get(id);
      if (!apiConfig) {
        return {
          content: [{ type: "text", text: `API ${id} not found` }],
        };
      }

      const apiUrl = apiConfig.api.url;
      const apiMethod = apiConfig.api.method;
      const apiParams = apiConfig.api.params || {};

      // Process user parameters
      let userParams: Record<string, any> = {};

      try {
        // Try to parse as JSON object
        userParams = JSON.parse(args);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            { type: "text", text: `Parameter format error: ${errorMessage}` },
          ],
        };
      }

      // Process URL placeholders
      let finalUrl = apiUrl;
      const urlPlaceholders = apiUrl.match(/\{([^}]+)\}/g) || [];

      for (const placeholder of urlPlaceholders) {
        const paramName = placeholder.replace(/[{}]/g, "");
        if (userParams[paramName]) {
          finalUrl = finalUrl.replace(
            placeholder,
            encodeURIComponent(userParams[paramName])
          );
          // Remove parameters used in URL from userParams
          delete userParams[paramName];
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Missing required URL parameter: ${paramName}`,
              },
            ],
          };
        }
      }

      // Merge request parameters
      const requestParams = { ...apiParams, ...userParams };

      let requestConfig: any = {
        url: finalUrl,
        method: apiMethod,
      };

      // Handle parameters based on request method
      if (apiMethod === "GET") {
        // Add parameters to URL query string for GET requests
        const queryString = new URLSearchParams(requestParams).toString();
        if (queryString) {
          finalUrl = `${finalUrl}${
            finalUrl.includes("?") ? "&" : "?"
          }${queryString}`;
          requestConfig.url = finalUrl;
        }
      } else if (apiMethod === "POST") {
        requestConfig.data = requestParams;
        requestConfig.headers = {
          "Content-Type": "application/json",
        };
      }

      const response = await Axios(requestConfig);

      return {
        content: [
          { type: "text", text: JSON.stringify(response.data, null, 2) },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          { type: "text", text: `Error processing request: ${errorMessage}` },
        ],
      };
    }
  }
);

// Load configurations before starting the server
try {
  await loadApiConfigs();
  const transport = new StdioServerTransport();
  await server.connect(transport);
} catch (error) {
  process.exit(1);
}
