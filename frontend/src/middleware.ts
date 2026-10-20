import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/constants';

const isDev = process.env.NODE_ENV === 'development';
const MOCK = process.env.NEXT_PUBLIC_MOCK === 'true';
const USE_CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) && !MOCK;

const PUBLIC_PATHS = new Set(['/login', '/admin/login', '/admin/signup']);
const isAdminArea = createRouteMatcher(['/admin(.*)']);
const isAdminAuthPage = createRouteMatcher(['/admin/login(.*)', '/admin/signup(.*)']);

const connectSrc = [process.env.NEXT_PUBLIC_API_URL, process.env.NEXT_PUBLIC_WS_URL].filter(
  (v): v is string => Boolean(v),
);

/** Optional cheap edge guard for the user area. Real authorisation is always enforced by the API. */
function userGuard(req: NextRequest): NextResponse | null {
  const { pathname } = req.nextUrl;
  if (
    process.env.SESSION_COOKIE_GUARD !== 'true' ||
    pathname.startsWith('/admin') ||
    PUBLIC_PATHS.has(pathname) ||
    req.cookies.has(SESSION_COOKIE)
  ) {
    return null;
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  return NextResponse.redirect(url);
}

/** Clerk generates a nonce-based strict CSP (incl. Clerk's own hosts); ClerkProvider reads the nonce. */
const withClerk = clerkMiddleware(
  async (auth, req) => {
    if (isAdminArea(req) && !isAdminAuthPage(req)) await auth.protect();
    return userGuard(req) ?? undefined;
  },
  {
    contentSecurityPolicy: {
      strict: true,
      directives: {
        'connect-src': connectSrc,
        'img-src': ['blob:', 'data:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        ...(isDev ? { 'script-src': ["'unsafe-eval'"] } : {}),
      },
    },
  },
);

/** Used when Clerk isn't configured or mock mode is on (no admin Clerk session needed). */
function plain(req: NextRequest) {
  const guard = userGuard(req);
  if (guard) return guard;

  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src ${["'self'", ...connectSrc].join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export default USE_CLERK ? withClerk : plain;

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
