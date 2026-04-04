/** PropertyIQ MCP Server Configuration */

export const config = {
  apiUrl:
    process.env.PROPERTYIQ_API_URL ||
    "https://backend-production-ee4d.up.railway.app",
  timeout: 15_000,
  defaultLimit: 25,
  maxLimit: 100,
};
