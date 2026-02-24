/**
 * Resend Invite Email API Route
 *
 * POST: Re-send the invite email to a tester using their current token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendInviteEmail } from '../../send-invite-email';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data: tester, error } = await supabase
      .from('beta_testers')
      .select('name, email, token')
      .eq('id', id)
      .single();

    if (error || !tester) {
      return NextResponse.json(
        { error: 'Tester not found' },
        { status: 404 },
      );
    }

    if (!tester.email) {
      return NextResponse.json(
        { error: 'Tester has no email address' },
        { status: 400 },
      );
    }

    const result = await sendInviteEmail({
      to: tester.email,
      name: tester.name,
      token: tester.token,
    });

    if (!result.sent) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend invite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
