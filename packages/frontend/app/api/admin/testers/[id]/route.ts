/**
 * Admin Tester [id] API Route
 *
 * DELETE: Soft-delete (deactivate) a tester
 * PATCH: Reactivate a deactivated tester
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('beta_testers')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deactivating tester:', error);
      return NextResponse.json(
        { error: 'Failed to deactivate tester' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tester deactivation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('beta_testers')
      .update({ is_active: true })
      .eq('id', id);

    if (error) {
      console.error('Error reactivating tester:', error);
      return NextResponse.json(
        { error: 'Failed to reactivate tester' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Tester reactivation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
