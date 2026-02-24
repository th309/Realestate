/**
 * Admin Testers API Route
 *
 * GET: List all testers (active and inactive)
 * POST: Create a new tester, optionally send invite email
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
import { sendInviteEmail } from './send-invite-email';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  sendEmail: z.boolean().optional().default(true),
});

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    const { data: testers, error } = await supabase
      .from('beta_testers')
      .select('id, name, email, token, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching testers:', error);
      return NextResponse.json(
        { error: 'Failed to fetch testers', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ testers: testers || [] });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error('Testers fetch error:', errorMessage);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validationResult = createSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid tester data', details: validationResult.error.issues },
        { status: 400 },
      );
    }

    const { name, email, sendEmail: shouldSendEmail } = validationResult.data;

    const supabase = createSupabaseAdminClient();

    const { data: tester, error } = await supabase
      .from('beta_testers')
      .insert({ name, email })
      .select()
      .single();

    if (error) {
      console.error('Error creating tester:', error);

      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A tester with this email already exists' },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: 'Failed to create tester' },
        { status: 500 },
      );
    }

    // Send invite email if requested and tester has an email
    let emailSent = false;
    if (shouldSendEmail && email) {
      const result = await sendInviteEmail({
        to: email,
        name,
        token: tester.token,
      });
      emailSent = result.sent;
    }

    return NextResponse.json({
      success: true,
      tester,
      emailSent,
      message: emailSent
        ? 'Tester created and invite email sent'
        : 'Tester created successfully',
    });
  } catch (error) {
    console.error('Tester creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
