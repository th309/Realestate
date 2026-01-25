/**
 * Beta Feedback File Upload API Route
 * 
 * POST: Upload a file to Supabase Storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/pdf',
];

async function validateToken(token: string): Promise<{ id: string } | null> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('beta_testers')
    .select('id, is_active')
    .eq('token', token)
    .single();
  
  if (error || !data || !data.is_active) {
    return null;
  }
  
  return { id: data.id };
}

export async function POST(request: NextRequest) {
  try {
    // Validate token
    const token = request.headers.get('X-Tester-Token');
    if (!token) {
      return NextResponse.json(
        { error: 'Missing tester token' },
        { status: 401 }
      );
    }

    const tester = await validateToken(token);
    if (!tester) {
      return NextResponse.json(
        { error: 'Invalid or inactive tester token' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not supported` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'bin';
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 50);
    const filename = `${timestamp}-${randomStr}-${sanitizedName}`;
    const storagePath = `${tester.id}/${filename}`;

    // Upload to Supabase Storage
    const supabase = createSupabaseAdminClient();
    
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('feedback-attachments')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      
      // Check if bucket doesn't exist
      if (uploadError.message?.includes('Bucket not found')) {
        return NextResponse.json(
          { error: 'Storage not configured. Please contact administrator.' },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get public URL (or signed URL for private bucket)
    const { data: urlData } = supabase
      .storage
      .from('feedback-attachments')
      .getPublicUrl(storagePath);

    // If bucket is private, generate signed URL instead
    let fileUrl = urlData.publicUrl;
    
    // For private buckets, create a signed URL valid for 7 days
    const { data: signedUrlData } = await supabase
      .storage
      .from('feedback-attachments')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days
    
    if (signedUrlData?.signedUrl) {
      fileUrl = signedUrlData.signedUrl;
    }

    const attachment = {
      url: fileUrl,
      filename: file.name,
      type: file.type,
      size: file.size,
      storagePath,
    };

    return NextResponse.json({
      success: true,
      attachment,
    });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
