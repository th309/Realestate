import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';
  const tosAccepted = searchParams.get('tos') === '1';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Record ToS acceptance for new signups
      await recordTosAcceptance(supabase, data.user, tosAccepted);

      if (type === 'recovery') {
        return NextResponse.redirect(
          `${origin}/account?tab=profile&reset=true`
        );
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code exchange failed or no code provided
  return NextResponse.redirect(
    `${origin}/auth/sign-in?error=auth_callback_failed`
  );
}

/**
 * Write tos_accepted_at to user_profiles if this is a new signup.
 *
 * Two signals indicate ToS was accepted:
 * 1. Email signup: tos_accepted_at in user_metadata (set during signUp())
 * 2. OAuth signup: tos=1 query param in callback URL
 *
 * Uses upsert so it works whether or not the user_profiles row exists yet.
 * Only writes if tos_accepted_at is currently NULL (won't overwrite).
 */
async function recordTosAcceptance(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: { id: string; user_metadata?: Record<string, unknown> },
  tosFromParam: boolean,
) {
  const tosFromMetadata = !!user.user_metadata?.tos_accepted_at;

  if (!tosFromParam && !tosFromMetadata) return;

  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        { id: user.id, tos_accepted_at: now },
        { onConflict: 'id', ignoreDuplicates: false },
      );

    if (error) {
      console.error('[auth/callback] Failed to record ToS acceptance:', error.message);
    }
  } catch (err) {
    console.error('[auth/callback] Failed to record ToS acceptance:', err);
  }
}
