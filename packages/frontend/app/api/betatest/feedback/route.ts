/**
 * Beta Feedback API Route
 * 
 * POST: Submit new feedback
 * GET: Get feedback for a tester (via token header)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

// Validation schema for feedback submission
const feedbackSchema = z.object({
  tester_id: z.string().uuid(),
  category: z.enum(['bug', 'workflow', 'ux_ui', 'feature_request', 'performance', 'other']),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  steps_to_reproduce: z.string().max(2000).optional(),
  expected_behavior: z.string().max(1000).optional(),
  actual_behavior: z.string().max(1000).optional(),
  page_url: z.string().max(500).optional(),
  affected_component: z.string().max(200).optional(),
  attachments: z.array(z.object({
    url: z.string().url(),
    filename: z.string(),
    type: z.string(),
    size: z.number(),
  })).default([]),
  browser_info: z.record(z.string()).optional(),
});

// Rate limiting: simple in-memory store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per window
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(token: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(token);
  
  if (!record || now > record.resetTime) {
    rateLimitStore.set(token, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  return true;
}

async function validateToken(token: string): Promise<{ id: string; name: string } | null> {
  const supabase = createSupabaseAdminClient();
  
  const { data, error } = await supabase
    .from('beta_testers')
    .select('id, name, is_active')
    .eq('token', token)
    .single();
  
  if (error || !data || !data.is_active) {
    return null;
  }
  
  return { id: data.id, name: data.name };
}

export async function POST(request: NextRequest) {
  try {
    // Get and validate token
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

    // Check rate limit
    if (!checkRateLimit(token)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const validationResult = feedbackSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid feedback data', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const feedbackData = validationResult.data;

    // Verify tester_id matches the token
    if (feedbackData.tester_id !== tester.id) {
      return NextResponse.json(
        { error: 'Tester ID mismatch' },
        { status: 403 }
      );
    }

    // Insert feedback
    const supabase = createSupabaseAdminClient();
    
    const { data: feedback, error: insertError } = await supabase
      .from('beta_feedback')
      .insert({
        tester_id: feedbackData.tester_id,
        category: feedbackData.category,
        severity: feedbackData.severity,
        title: feedbackData.title,
        description: feedbackData.description,
        steps_to_reproduce: feedbackData.steps_to_reproduce,
        expected_behavior: feedbackData.expected_behavior,
        actual_behavior: feedbackData.actual_behavior,
        page_url: feedbackData.page_url,
        affected_component: feedbackData.affected_component,
        attachments: feedbackData.attachments,
        browser_info: feedbackData.browser_info,
        status: 'submitted',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting feedback:', insertError);
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      feedback,
      message: 'Feedback submitted successfully' 
    });
  } catch (error) {
    console.error('Feedback submission error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
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

    const supabase = createSupabaseAdminClient();
    
    const { data: feedback, error } = await supabase
      .from('beta_feedback')
      .select('id, title, category, status, created_at')
      .eq('tester_id', tester.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching feedback:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({ feedback: feedback || [] });
  } catch (error) {
    console.error('Feedback fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
