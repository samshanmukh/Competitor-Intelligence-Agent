import { NextResponse } from 'next/server';

// Public pages anyone can see without a session.
const PUBLIC_EXACT = ['/'];                                  // landing page
const PUBLIC_PREFIX = ['/login', '/signup', '/verify', '/auth', '/requests'];

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('cia_auth')?.value;

  const isPublic =
    PUBLIC_EXACT.includes(pathname) || PUBLIC_PREFIX.some((p) => pathname.startsWith(p));

  if (!token && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    return NextResponse.redirect(url);
  }

  // Logged-in users hitting an auth page go straight to the app.
  if (token && PUBLIC_PREFIX.some((p) => pathname.startsWith(p)) && !pathname.startsWith('/auth')) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json).*)'],
};
