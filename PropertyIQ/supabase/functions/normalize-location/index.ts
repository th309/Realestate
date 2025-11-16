// Normalize Location Edge Function
// Batch processes location text to standardized GEOIDs using the database normalize_location function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import {
  NormalizeLocationRequest,
  NormalizeLocationResponse,
} from "../_shared/database-types.ts";

import {
  supabaseServiceClient,
  normalizeLocation,
} from "../_shared/supabase-client.ts";

import {
  corsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
  validateMethod,
  parseJsonBody,
  checkRateLimit,
  logRequest,
  logError,
} from "../_shared/cors.ts";

// Maximum locations per batch
const MAX_BATCH_SIZE = 100;
const MAX_CONCURRENT = 10; // Process 10 locations concurrently

// Process a single location
async function processSingleLocation(
  location: { id: string; text: string; state?: string }
): Promise<{
  id: string;
  geoid: string;
  confidence: number;
  match_type: string;
  error?: string;
}> {
  try {
    // Validate input
    if (!location.text || location.text.trim().length === 0) {
      return {
        id: location.id,
        geoid: '',
        confidence: 0,
        match_type: 'none',
        error: 'Empty location text',
      };
    }

    // Clean and prepare input text
    const cleanedText = location.text
      .trim()
      .replace(/\s+/g, ' ')
      .substring(0, 500); // Limit length

    // Call the database function
    const result = await normalizeLocation(cleanedText, location.state);

    // Handle null results
    if (!result || !result.geoid) {
      return {
        id: location.id,
        geoid: '',
        confidence: 0,
        match_type: 'none',
        error: 'No match found',
      };
    }

    return {
      id: location.id,
      geoid: result.geoid,
      confidence: result.confidence,
      match_type: result.match_type,
    };

  } catch (error) {
    console.error(`Error processing location ${location.id}:`, error);
    return {
      id: location.id,
      geoid: '',
      confidence: 0,
      match_type: 'error',
      error: error.message || 'Processing error',
    };
  }
}

// Process locations in batches with concurrency control
async function processBatch(
  locations: Array<{ id: string; text: string; state?: string }>
): Promise<Array<{
  id: string;
  geoid: string;
  confidence: number;
  match_type: string;
  error?: string;
}>> {
  const results = [];
  
  // Process in chunks of MAX_CONCURRENT
  for (let i = 0; i < locations.length; i += MAX_CONCURRENT) {
    const chunk = locations.slice(i, i + MAX_CONCURRENT);
    const chunkResults = await Promise.all(
      chunk.map(location => processSingleLocation(location))
    );
    results.push(...chunkResults);
  }
  
  return results;
}

// Cache implementation for frequently requested locations
const locationCache = new Map<string, {
  geoid: string;
  confidence: number;
  match_type: string;
  timestamp: number;
}>();

const CACHE_TTL = 3600000; // 1 hour in milliseconds

function getCacheKey(text: string, state?: string): string {
  return `${text.toLowerCase().trim()}|${state?.toLowerCase() || ''}`;
}

function getCachedResult(
  location: { id: string; text: string; state?: string }
): {
  id: string;
  geoid: string;
  confidence: number;
  match_type: string;
} | null {
  const cacheKey = getCacheKey(location.text, location.state);
  const cached = locationCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return {
      id: location.id,
      geoid: cached.geoid,
      confidence: cached.confidence,
      match_type: cached.match_type,
    };
  }
  
  // Remove expired entry
  if (cached) {
    locationCache.delete(cacheKey);
  }
  
  return null;
}

function setCachedResult(
  location: { text: string; state?: string },
  result: { geoid: string; confidence: number; match_type: string }
): void {
  const cacheKey = getCacheKey(location.text, location.state);
  
  // Limit cache size
  if (locationCache.size > 10000) {
    // Remove oldest entries
    const entriesToRemove = Array.from(locationCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)
      .slice(0, 1000)
      .map(([key]) => key);
    
    entriesToRemove.forEach(key => locationCache.delete(key));
  }
  
  locationCache.set(cacheKey, {
    ...result,
    timestamp: Date.now(),
  });
}

// Main handler
serve(async (req: Request) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Validate method
  const methodError = validateMethod(req, ['POST']);
  if (methodError) return methodError;

  // Log request
  logRequest(req);

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for') || 
                     req.headers.get('x-real-ip') || 
                     'unknown';
    
    // Check rate limit (100 requests per minute)
    const rateLimitError = checkRateLimit(clientIp, 100, 60000);
    if (rateLimitError) return rateLimitError;

    // Parse request body
    const { data: body, error: parseError } = await parseJsonBody<NormalizeLocationRequest>(req);
    if (parseError) return parseError;

    // Validate request
    if (!body?.locations || !Array.isArray(body.locations)) {
      return errorResponse('Missing or invalid locations array');
    }

    if (body.locations.length === 0) {
      return errorResponse('Locations array cannot be empty');
    }

    if (body.locations.length > MAX_BATCH_SIZE) {
      return errorResponse(
        `Too many locations. Maximum ${MAX_BATCH_SIZE} locations per request`,
        400,
        { provided: body.locations.length, maximum: MAX_BATCH_SIZE }
      );
    }

    // Validate each location
    for (const location of body.locations) {
      if (!location.id || typeof location.id !== 'string') {
        return errorResponse('Each location must have a valid id');
      }
      if (!location.text || typeof location.text !== 'string') {
        return errorResponse('Each location must have valid text');
      }
      if (location.state && typeof location.state !== 'string') {
        return errorResponse('State must be a string if provided');
      }
    }

    // Separate cached and uncached locations
    const cachedResults = [];
    const uncachedLocations = [];
    
    for (const location of body.locations) {
      const cached = getCachedResult(location);
      if (cached) {
        cachedResults.push(cached);
      } else {
        uncachedLocations.push(location);
      }
    }

    console.log(`Processing ${body.locations.length} locations: ${cachedResults.length} cached, ${uncachedLocations.length} to process`);

    // Process uncached locations
    let processedResults = [];
    if (uncachedLocations.length > 0) {
      processedResults = await processBatch(uncachedLocations);
      
      // Cache successful results
      for (let i = 0; i < uncachedLocations.length; i++) {
        const location = uncachedLocations[i];
        const result = processedResults[i];
        
        if (result && !result.error && result.geoid) {
          setCachedResult(location, {
            geoid: result.geoid,
            confidence: result.confidence,
            match_type: result.match_type,
          });
        }
      }
    }

    // Combine results
    const allResults = [...cachedResults, ...processedResults];
    
    // Sort results by original order
    const resultMap = new Map(allResults.map(r => [r.id, r]));
    const sortedResults = body.locations.map(loc => 
      resultMap.get(loc.id) || {
        id: loc.id,
        geoid: '',
        confidence: 0,
        match_type: 'error',
        error: 'Result not found',
      }
    );

    // Calculate statistics
    const stats = {
      total: sortedResults.length,
      successful: sortedResults.filter(r => r.geoid && !r.error).length,
      failed: sortedResults.filter(r => r.error).length,
      cached: cachedResults.length,
      averageConfidence: sortedResults
        .filter(r => r.confidence > 0)
        .reduce((sum, r) => sum + r.confidence, 0) / 
        (sortedResults.filter(r => r.confidence > 0).length || 1),
    };

    console.log('Normalization stats:', stats);

    // Return response
    const response: NormalizeLocationResponse = {
      results: sortedResults,
    };

    return jsonResponse(response, 200, {
      'X-Cached-Results': cachedResults.length.toString(),
      'X-Processed-Results': processedResults.length.toString(),
    });

  } catch (error) {
    logError(error, { function: 'normalize-location' });
    
    return errorResponse(
      'Internal server error',
      500,
      { error: error.message }
    );
  }
});
