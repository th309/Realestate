// Process Upload Edge Function
// Handles file processing for GeoJSON, CSV, and Shapefile uploads

import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { parse as parseCSV } from "https://deno.land/std@0.168.0/csv/mod.ts";

import {
  ProcessUploadRequest,
  ProcessUploadResponse,
  SpatialUpload,
  SpatialStaging,
  StagingData,
} from "../_shared/database-types.ts";

import {
  supabaseServiceClient,
  getFileFromStorage,
  batchInsert,
} from "../_shared/supabase-client.ts";

import {
  corsHeaders,
  handleCors,
  jsonResponse,
  errorResponse,
  validateMethod,
  parseJsonBody,
  logRequest,
  logError,
} from "../_shared/cors.ts";

// Process GeoJSON file
async function processGeoJSON(
  uploadId: string,
  fileContent: string
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let processedCount = 0;

  try {
    const geoJson = JSON.parse(fileContent);
    
    if (geoJson.type !== 'FeatureCollection' || !Array.isArray(geoJson.features)) {
      throw new Error('Invalid GeoJSON format. Expected FeatureCollection.');
    }

    const stagingRecords: Partial<SpatialStaging>[] = [];

    for (let i = 0; i < geoJson.features.length; i++) {
      const feature = geoJson.features[i];
      
      try {
        // Validate feature structure
        if (!feature.geometry || !feature.properties) {
          errors.push(`Feature ${i}: Missing geometry or properties`);
          continue;
        }

        // Extract name from properties (common fields)
        const extractedName = 
          feature.properties.name ||
          feature.properties.NAME ||
          feature.properties.title ||
          feature.properties.TITLE ||
          feature.properties.label ||
          feature.properties.LABEL ||
          `Feature_${i}`;

        // Convert geometry to WKT for PostGIS
        const geometryWKT = geometryToWKT(feature.geometry);

        stagingRecords.push({
          upload_id: uploadId,
          geometry_wgs84: geometryWKT,
          properties: feature.properties,
          extracted_name: extractedName,
        });

      } catch (featureError) {
        errors.push(`Feature ${i}: ${featureError.message}`);
      }
    }

    // Batch insert into spatial_staging
    if (stagingRecords.length > 0) {
      // Use raw SQL for geometry insertion
      for (const record of stagingRecords) {
        const { error } = await supabaseServiceClient
          .from('spatial_staging')
          .insert({
            upload_id: record.upload_id,
            geometry_wgs84: record.geometry_wgs84,
            properties: record.properties,
            extracted_name: record.extracted_name,
          });

        if (error) {
          errors.push(`Insert error: ${error.message}`);
        } else {
          processedCount++;
        }
      }
    }

  } catch (error) {
    errors.push(`GeoJSON parsing error: ${error.message}`);
  }

  return { count: processedCount, errors };
}

// Process CSV file
async function processCSV(
  uploadId: string,
  fileContent: string,
  options?: { delimiter?: string; headers?: boolean }
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  let processedCount = 0;

  try {
    const csvOptions = {
      separator: options?.delimiter || ',',
      skipFirstRow: options?.headers !== false,
    };

    const parsed = parseCSV(fileContent, csvOptions);
    const stagingRecords: Partial<StagingData>[] = [];

    // If headers are present, use them as keys
    const headers = options?.headers !== false && parsed.length > 0 
      ? Object.keys(parsed[0] as any)
      : null;

    for (let i = 0; i < parsed.length; i++) {
      const row = parsed[i];
      
      try {
        const rawData = headers 
          ? row as Record<string, any>
          : Object.fromEntries((row as string[]).map((val, idx) => [`column_${idx}`, val]));

        stagingRecords.push({
          source_id: uploadId,
          raw_data: rawData,
        });

      } catch (rowError) {
        errors.push(`Row ${i + 1}: ${rowError.message}`);
      }
    }

    // Batch insert into staging_data
    if (stagingRecords.length > 0) {
      processedCount = await batchInsert('staging_data', stagingRecords, 500);
    }

  } catch (error) {
    errors.push(`CSV parsing error: ${error.message}`);
  }

  return { count: processedCount, errors };
}

// Process Shapefile (requires conversion to GeoJSON first)
async function processShapefile(
  uploadId: string,
  fileContent: ArrayBuffer
): Promise<{ count: number; errors: string[] }> {
  const errors: string[] = [];
  
  // Note: Shapefile processing requires additional libraries
  // In production, you might want to use a separate service for shapefile conversion
  // For now, we'll return an error indicating this
  errors.push('Shapefile processing requires external conversion service. Please convert to GeoJSON first.');
  
  return { count: 0, errors };
}

// Convert geometry to WKT format
function geometryToWKT(geometry: any): string {
  const type = geometry.type;
  const coords = geometry.coordinates;

  switch (type) {
    case 'Point':
      return `POINT(${coords[0]} ${coords[1]})`;
    
    case 'LineString':
      return `LINESTRING(${coords.map((c: number[]) => `${c[0]} ${c[1]}`).join(',')})`;
    
    case 'Polygon':
      return `POLYGON(${coords.map((ring: number[][]) => 
        `(${ring.map((c: number[]) => `${c[0]} ${c[1]}`).join(',')})`
      ).join(',')})`;
    
    case 'MultiPoint':
      return `MULTIPOINT(${coords.map((c: number[]) => `(${c[0]} ${c[1]})`).join(',')})`;
    
    case 'MultiLineString':
      return `MULTILINESTRING(${coords.map((line: number[][]) => 
        `(${line.map((c: number[]) => `${c[0]} ${c[1]}`).join(',')})`
      ).join(',')})`;
    
    case 'MultiPolygon':
      return `MULTIPOLYGON(${coords.map((polygon: number[][][]) => 
        `(${polygon.map((ring: number[][]) => 
          `(${ring.map((c: number[]) => `${c[0]} ${c[1]}`).join(',')})`
        ).join(',')})`
      ).join(',')})`;
    
    default:
      throw new Error(`Unsupported geometry type: ${type}`);
  }
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
    // Parse request body
    const { data: body, error: parseError } = await parseJsonBody<ProcessUploadRequest>(req);
    if (parseError) return parseError;

    // Validate request
    if (!body?.file_id || !body?.file_type) {
      return errorResponse('Missing required fields: file_id and file_type');
    }

    // Get upload record
    const { data: upload, error: uploadError } = await supabaseServiceClient
      .from('spatial_uploads')
      .select('*')
      .eq('id', body.file_id)
      .single();

    if (uploadError || !upload) {
      return errorResponse('Upload not found', 404);
    }

    // Update status to processing
    await supabaseServiceClient
      .from('spatial_uploads')
      .update({ processing_status: 'processing' })
      .eq('id', body.file_id);

    let result: { count: number; errors: string[] };

    // Process based on file type
    switch (body.file_type) {
      case 'geojson': {
        // Get file from storage or files JSONB
        let fileContent: string;
        
        if (upload.files?.content) {
          fileContent = upload.files.content;
        } else if (upload.files?.storage_path) {
          const fileBuffer = await getFileFromStorage('uploads', upload.files.storage_path);
          fileContent = new TextDecoder().decode(fileBuffer);
        } else {
          throw new Error('No file content found');
        }

        result = await processGeoJSON(body.file_id, fileContent);
        break;
      }

      case 'csv': {
        // Get file from storage or files JSONB
        let fileContent: string;
        
        if (upload.files?.content) {
          fileContent = upload.files.content;
        } else if (upload.files?.storage_path) {
          const fileBuffer = await getFileFromStorage('uploads', upload.files.storage_path);
          fileContent = new TextDecoder().decode(fileBuffer);
        } else {
          throw new Error('No file content found');
        }

        result = await processCSV(body.file_id, fileContent, body.options);
        break;
      }

      case 'shapefile': {
        if (!upload.files?.storage_path) {
          throw new Error('Shapefile must be uploaded to storage');
        }
        
        const fileBuffer = await getFileFromStorage('uploads', upload.files.storage_path);
        result = await processShapefile(body.file_id, fileBuffer);
        break;
      }

      default:
        return errorResponse(`Unsupported file type: ${body.file_type}`);
    }

    // Update upload status
    const finalStatus = result.errors.length > 0 && result.count === 0 ? 'failed' : 'completed';
    await supabaseServiceClient
      .from('spatial_uploads')
      .update({ 
        processing_status: finalStatus,
        files: {
          ...upload.files,
          processed_count: result.count,
          errors: result.errors,
        }
      })
      .eq('id', body.file_id);

    // Return response
    const response: ProcessUploadResponse = {
      success: result.count > 0,
      processed_count: result.count,
      errors: result.errors.length > 0 ? result.errors : undefined,
      upload_id: body.file_id,
    };

    return jsonResponse(response);

  } catch (error) {
    logError(error, { function: 'process-upload' });
    
    // Try to update upload status to failed
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        if (body?.file_id) {
          await supabaseServiceClient
            .from('spatial_uploads')
            .update({ processing_status: 'failed' })
            .eq('id', body.file_id);
        }
      } catch {}
    }

    return errorResponse(
      'Internal server error',
      500,
      { error: error.message }
    );
  }
});
