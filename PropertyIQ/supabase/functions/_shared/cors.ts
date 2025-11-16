// CORS Headers for Edge Functions
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Helper function to handle CORS preflight requests
export function handleCors(req: Request): Response | null {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}

// Helper function to create a JSON response with CORS headers
export function jsonResponse(
  data: any,
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        ...additionalHeaders,
      },
    }
  );
}

// Helper function to create an error response
export function errorResponse(
  message: string,
  status: number = 400,
  details?: any
): Response {
  const errorBody = {
    error: message,
    status,
    ...(details && { details }),
  };

  return jsonResponse(errorBody, status);
}

// Helper function to validate request method
export function validateMethod(
  req: Request,
  allowedMethods: string[]
): Response | null {
  if (!allowedMethods.includes(req.method)) {
    return errorResponse(
      `Method ${req.method} not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
      405
    );
  }
  return null;
}

// Helper function to get authenticated user from request
export async function getAuthenticatedUser(
  req: Request,
  supabaseClient: any
): Promise<{ user: any; error: Response | null }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return {
      user: null,
      error: errorResponse('Missing authorization header', 401),
    };
  }

  const token = authHeader.replace('Bearer ', '');
  
  const { data: { user }, error } = await supabaseClient.auth.getUser(token);
  
  if (error || !user) {
    return {
      user: null,
      error: errorResponse('Invalid or expired token', 401),
    };
  }

  return { user, error: null };
}

// Helper function to parse and validate JSON body
export async function parseJsonBody<T = any>(
  req: Request
): Promise<{ data: T | null; error: Response | null }> {
  try {
    const body = await req.json();
    return { data: body as T, error: null };
  } catch (error) {
    return {
      data: null,
      error: errorResponse('Invalid JSON body', 400, { parseError: error.message }),
    };
  }
}

// Rate limiting helper (simple in-memory implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): Response | null {
  const now = Date.now();
  const userLimit = rateLimitMap.get(identifier);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return null;
  }

  if (userLimit.count >= maxRequests) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
    return errorResponse(
      'Rate limit exceeded',
      429,
      {
        retryAfter,
        limit: maxRequests,
        windowMs,
      }
    );
  }

  userLimit.count++;
  return null;
}

// Logging helper
export function logRequest(
  req: Request,
  context: Record<string, any> = {}
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries()),
    ...context,
  };
  
  console.log('Request:', JSON.stringify(logEntry));
}

export function logError(
  error: Error,
  context: Record<string, any> = {}
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  };
  
  console.error('Error:', JSON.stringify(logEntry));
}
