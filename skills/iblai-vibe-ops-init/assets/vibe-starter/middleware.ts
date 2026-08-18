import type { NextRequest } from 'next/server';
import { applyCsp } from '@iblai/iblai-js/security/next';

// Server components don't have direct access to the request URL/pathname.
// Forward the pathname as a header so layouts can read it via `headers()` and
// branch on the current route (used to fetch the public platform-membership
// config server-side before rendering `Providers`).
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  // Attach the per-request, nonce-based Content-Security-Policy. applyCsp
  // stamps the nonce onto these same request headers — preserving x-pathname —
  // and returns the response carrying the CSP header.
  //
  // `next dev` runs report-only so React Refresh / eval() and the error
  // overlay work (the SDK auto-allows dev eval in report-only mode). NODE_ENV
  // is inlined per build command, so production builds pass `undefined` and
  // the SDK's own resolution stays authoritative: enforce by default, with a
  // validated CSP_MODE env override.
  return applyCsp(request, {
    requestHeaders,
    mode: process.env.NODE_ENV === 'development' ? 'report-only' : undefined,
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
