import type { NextRequest } from 'next/server';
import { applyCsp } from '@iblai/iblai-js/security/next';

// NOTE: on Next.js 16+ this file convention is deprecated — rename it to
// `proxy.ts` and rename the exported function to `proxy`. The body is
// unchanged. See https://nextjs.org/docs/messages/middleware-to-proxy

// Server components don't have direct access to the request URL/pathname.
// Forward the pathname as a header so layouts can read it via `headers()` and
// branch on the current route.
export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', request.nextUrl.pathname);

  // Attach the per-request, nonce-based Content-Security-Policy. applyCsp
  // stamps the nonce onto these same request headers — preserving x-pathname —
  // and returns the response carrying the CSP header.
  return applyCsp(request, {
    requestHeaders,
    // React's dev build needs eval() for source maps and callstack
    // reconstruction. Without this every dev page load reports
    // "eval() is not supported in this environment". Never on in production.
    dev: isDev,
    // Report-only locally so a policy gap surfaces as a console report rather
    // than a broken page; enforce everywhere else.
    mode:
      (process.env.CSP_MODE as 'enforce' | 'report-only') ??
      (isDev ? 'report-only' : 'enforce'),
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
