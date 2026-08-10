import type { NextRequest } from 'next/server';
import { applyCsp } from '@iblai/iblai-js/security/next';

// Server components don't have direct access to the request URL/pathname.
// Forward the pathname as a header so layouts can read it via `headers()` and
// branch on the current route (used to fetch the public platform-membership
// config server-side before rendering `Providers`).
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);
  // Attach the per-request, nonce-based Content-Security-Policy. Report-only by
  // default (set CSP_MODE=enforce once violation reports are clean). applyCsp
  // stamps the nonce onto these same request headers — preserving x-pathname —
  // and returns the response carrying the CSP header.
  return applyCsp(request, { requestHeaders });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
