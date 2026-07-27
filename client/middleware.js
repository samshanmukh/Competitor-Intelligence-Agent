import { NextResponse } from 'next/server';
import { authBypassActiveForHost, DEV_BYPASS_TOKEN } from './lib/authBypass';
import { countMarkdownTokens, getPageMarkdown, SITE_ORIGIN } from './lib/agentContent';

// Public pages anyone can see without a session.
const PUBLIC_EXACT = [
  '/',
  '/architecture',
  '/methodology',
  '/about',
  '/team',
  '/contact',
  '/guide',
  '/faq',
  '/privacy',
  '/terms',
  '/competitive-intelligence-software',
  '/competitor-pricing-analysis',
  '/tam-sam-som',
  '/find-saas-competitors',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/AGENTS.md',
  '/mira-mark.svg',
  '/mira-mark.png',
  '/mira-logo.svg',
  '/mira-logo.png',
  '/og-default.png',
  '/icon.svg',
  '/favicon-32.png',
  '/apple-touch-icon.png',
];
const PUBLIC_PREFIX = [
  '/login',
  '/signup',
  '/verify',
  '/oauth',
  '/auth',
  '/requests',
  '/reports/shared',
  '/invite',
  '/.well-known',
];

function tokenLooksCurrent(token) {
  if (!token) return false;
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

function hasRefreshSession(request) {
  return Boolean(request.cookies.get('cia_refresh')?.value);
}

function sessionLooksAlive(request) {
  const token = request.cookies.get('cia_auth')?.value;
  return tokenLooksCurrent(token) || hasRefreshSession(request);
}

function wantsMarkdown(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  const md = accept.indexOf('text/markdown');
  const html = accept.indexOf('text/html');
  if (html === -1) return true;
  return md <= html;
}

function markdownResponse(pathname) {
  const md = getPageMarkdown(pathname);
  if (!md) return null;
  const tokens = countMarkdownTokens(md);
  return new NextResponse(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      Vary: 'Accept',
      'X-Markdown-Tokens': String(tokens),
      Link: [
        `<${SITE_ORIGIN}/llms.txt>; rel="alternate"; type="text/markdown"`,
        `<${SITE_ORIGIN}/sitemap.xml>; rel="sitemap"; type="application/xml"`,
        `<${SITE_ORIGIN}/AGENTS.md>; rel="help"; type="text/markdown"`,
        `<${SITE_ORIGIN}/.well-known/mcp/server-card.json>; rel="describedby"; type="application/json"`,
      ].join(', '),
    },
  });
}

export function middleware(request) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;
  const bypass = authBypassActiveForHost(hostname);
  const token = request.cookies.get('cia_auth')?.value;

  // AI agents requesting compact Markdown for public docs/marketing pages.
  if (wantsMarkdown(request)) {
    const mdRes = markdownResponse(pathname);
    if (mdRes) return mdRes;
  }

  if (bypass) {
    if (PUBLIC_PREFIX.some((p) => pathname.startsWith(p)) && !pathname.startsWith('/auth')) {
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
    PUBLIC_EXACT.includes(pathname)
    || PUBLIC_PREFIX.some((p) => pathname.startsWith(p));
  const alive = sessionLooksAlive(request);

  if (!alive && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('from', pathname);
    const response = NextResponse.redirect(url);
    response.cookies.delete('cia_auth');
    response.cookies.delete('cia_workspace_id');
    response.cookies.delete('cia_refresh');
    return response;
  }

  if (alive && PUBLIC_PREFIX.some((p) => pathname.startsWith(p)) && !pathname.startsWith('/auth')) {
    // Keep shared report / invite links usable while logged in.
    if (
      pathname.startsWith('/reports/shared')
      || pathname.startsWith('/invite')
      || pathname.startsWith('/requests')
      || pathname.startsWith('/.well-known')
    ) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip auth for static agent-discovery assets (served from /public).
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|robots\\.txt|sitemap\\.xml|llms\\.txt|AGENTS\\.md|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
