import { NextResponse } from 'next/server';
import { authBypassActiveForHost, DEV_BYPASS_TOKEN } from './lib/authBypass';

// Public pages anyone can see without a session.
const PUBLIC_EXACT = ['/', '/architecture'];                 // landing + public docs
const PUBLIC_PREFIX = ['/login', '/signup', '/verify', '/oauth', '/auth', '/requests', '/reports/shared', '/invite'];

function tokenLooksCurrent(token) {
  if (!token) return false;
  // Localhost auth bypass uses a fixed opaque token (not a JWT).
  if (token === DEV_BYPASS_TOKEN) return true;
  try {
    const [, payload] = token.split('.');
    if (!payload) return false;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(padded));
    return !decoded.exp || decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;
  const bypass = authBypassActiveForHost(hostname);
  const token = request.cookies.get('cia_auth')?.value;

  // Localhost + AUTH_BYPASS: skip login redirects; seed a cookie if missing.
  if (bypass) {
    if (PUBLIC_PREFIX.some((p) => pathname.startsWith(p)) && !pathname.startsWith('/auth')) {
      // Keep auth pages reachable for testing, but default entry goes to app.
      if (pathname === '/login' || pathname === '/signup') {
        return NextResponse.redirect(new URL('/app', request.url));
      }
    }
    if (!tokenLooksCurrent(token)) {
      const response = NextResponse.next();
      response.cookies.set('cia_auth', DEV_BYPASS_TOKEN, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
      });
      return response;
    }
    return NextResponse.next();
  }

  const isPublic =
    PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIX.some((p) => pathname.startsWith(p));

  if (!tokenLooksCurrent(token) && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    const response = NextResponse.redirect(url);
    response.cookies.delete('cia_auth');
    response.cookies.delete('cia_workspace_id');
    return response;
  }

  // Logged-in users hitting an auth page go straight to the app.
  if (tokenLooksCurrent(token) && PUBLIC_PREFIX.some((p) => pathname.startsWith(p)) && !pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'],
};
