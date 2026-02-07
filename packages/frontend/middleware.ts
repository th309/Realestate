import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Middleware
 *
 * Handles route protection and redirects.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Block /_dev routes in production
  if (pathname.startsWith('/_dev')) {
    if (process.env.NODE_ENV === 'production') {
      // Return 404 in production
      return NextResponse.rewrite(new URL('/not-found', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  // Match /_dev routes
  matcher: ['/_dev/:path*'],
};
