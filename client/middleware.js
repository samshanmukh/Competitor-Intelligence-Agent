import { NextResponse } from 'next/server';
import { countMarkdownTokens, getPageMarkdown, SITE_ORIGIN } from './lib/agentContent';
import { shouldShowGeoCornerstone } from './lib/geoCrawler';

const LEGACY_AUTH_PATHS = ['/login', '/signup', '/verify', '/oauth', '/auth/callback'];

function wantsMarkdown(request) {
  const accept = (request.headers.get('accept') || '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  const markdownIndex = accept.indexOf('text/markdown');
  const htmlIndex = accept.indexOf('text/html');
  return htmlIndex === -1 || markdownIndex <= htmlIndex;
}

function markdownResponse(pathname) {
  const markdown = getPageMarkdown(pathname);
  if (!markdown) return null;
  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      Vary: 'Accept',
      'X-Markdown-Tokens': String(countMarkdownTokens(markdown)),
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

  if (LEGACY_AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  if (wantsMarkdown(request)) {
    const response = markdownResponse(pathname);
    if (response) return response;
  }

  const response = NextResponse.next();
  if (pathname === '/') {
    const showGeo = shouldShowGeoCornerstone({
      ua: request.headers.get('user-agent'),
      referer: request.headers.get('referer'),
      searchParams: request.nextUrl.searchParams,
    });
    if (showGeo) response.headers.set('x-mira-geo-cornerstone', '1');
    response.headers.set('Vary', 'User-Agent, Accept');
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.json|robots\\.txt|sitemap\\.xml|llms\\.txt|AGENTS\\.md|\\.well-known/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
