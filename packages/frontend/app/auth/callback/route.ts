import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
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
