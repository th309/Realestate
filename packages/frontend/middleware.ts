import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Next.js Middleware
 *
 * - Refreshes the Supabase auth session on every matched request
 * - Redirects unauthenticated users away from protected routes
 * - Redirects authenticated users away from auth routes
 * - Blocks /_dev routes in production
 */

const PROTECTED_PREFIXES = ['/account', '/dashboard', '/alerts', '/reports'];
const AUTH_ROUTES = ['/auth/sign-in', '/auth/sign-up', '/auth/forgot-password'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — must call getUser() to keep cookies in sync
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Block /_dev routes in production
  if (pathname.startsWith('/_dev')) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.rewrite(new URL('/not-found', request.url));
    }
  }

  // Protected routes — redirect unauthenticated users to sign-in
  // Allow bypass in dev mode with ?bypass_auth=true param or cookie for visual testing
  const bypassParam = request.nextUrl.searchParams.has('bypass_auth');
  const bypassCookie = request.cookies.get('bypass_auth')?.value === 'true';
  const bypassAuth = process.env.NODE_ENV !== 'production' && (bypassParam || bypassCookie);
  if (bypassParam && !bypassCookie) {
    supabaseResponse.cookies.set('bypass_auth', 'true', { path: '/', maxAge: 3600 });
  }
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && !user && !bypassAuth) {
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Auth routes — redirect authenticated users to dashboard
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname === route);
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/(account|dashboard|alerts|reports|auth|_dev)(.*)'],
};
