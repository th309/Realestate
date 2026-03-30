/** PropertyIQ MCP Server Configuration */

export const config = {
  /** Backend API base URL */
  apiUrl:
    process.env.PROPERTYIQ_API_URL ||
    "https://backend-production-ee4d.up.railway.app",
  /** Request timeout in ms */
  timeout: 15_000,
  /** Default result limit for list endpoints */
  defaultLimit: 25,
  /** Max result limit */
  maxLimit: 100,
};
