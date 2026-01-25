/**
 * Admin Feedback Item API Route
 * 
 * GET: Get single feedback item
 * PATCH: Update feedback status/notes
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const updateSchema = z.object({
  status: z.enum(['submitted', 'triaged', 'in_progress', 'fixed', 'deployed', 'wont_fix', 'duplicate']).optional(),
  admin_notes: z.string().max(5000).optional(),
  fix_reference: z.string().max(500).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();
    
    const { data: feedback, error } = await supabase
      .from('beta_feedback')
      .select(`
        *,
        tester:beta_testers(name, email)
      `)
      .eq('id', id)
      .single();

    if (error || !feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Feedback fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const validationResult = updateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid update data', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const updateData = validationResult.data;
    
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No update fields provided' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    
    const { data: feedback, error } = await supabase
      .from('beta_feedback')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating feedback:', error);
      return NextResponse.json(
        { error: 'Failed to update feedback' },
        { status: 500 }
      );
    }

    if (!feedback) {
      return NextResponse.json(
        { error: 'Feedback not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Feedback update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
