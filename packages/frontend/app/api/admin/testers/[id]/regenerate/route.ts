/**
 * Regenerate Tester Token API Route
 *
 * POST: Generate a new token for a tester. Old link stops working.
 * Sends invite email if tester has an email address.
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

    // Generate a new 32-char hex token
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const newToken = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const { data: updated, error } = await supabase
      .from('beta_testers')
      .update({ token: newToken })
      .eq('id', id)
      .select('id, name, email, token')
      .single();

    if (error) {
      console.error('Error regenerating token:', error);
      return NextResponse.json(
        { error: 'Failed to regenerate token' },
        { status: 500 },
      );
    }

    // Send email with new link if tester has email
    let emailSent = false;
    if (updated.email) {
      const result = await sendInviteEmail({
        to: updated.email,
        name: updated.name,
        token: updated.token,
      });
      emailSent = result.sent;
    }

    return NextResponse.json({
      success: true,
      token: updated.token,
      emailSent,
    });
  } catch (error) {
    console.error('Token regeneration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
