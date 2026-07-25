/**
 * Secure browser session cookies for Mira auth.
 * - Access token: readable by middleware (not httpOnly), 24h max-age
 * - Refresh token: httpOnly + Secure + SameSite=Lax, 7d max-age (survives browser close)
 */

import { NextResponse } from 'next/server';

export const ACCESS_COOKIE = 'cia_auth';
export const REFRESH_COOKIE = 'cia_refresh';
export const WORKSPACE_COOKIE = 'cia_workspace_id';

/** Access token cookie / localStorage lifetime — at least 24h as requested. */
export const ACCESS_MAX_AGE = 60 * 60 * 24; // 24 hours
/** Refresh token lifetime — keeps the browser signed in across closes. */
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secureCookie() {
  return process.env.NODE_ENV === 'production';
}

export function applyAuthCookies(response, { accessToken, refreshToken, workspaceId } = {}) {
  if (accessToken) {
    response.cookies.set(ACCESS_COOKIE, accessToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure: secureCookie(),
      path: '/',
      maxAge: ACCESS_MAX_AGE,
    });
  }
  if (refreshToken) {
    response.cookies.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookie(),
      path: '/',
      maxAge: REFRESH_MAX_AGE,
    });
  }
  if (workspaceId != null && workspaceId !== '') {
    response.cookies.set(WORKSPACE_COOKIE, String(workspaceId), {
      httpOnly: false,
      sameSite: 'lax',
      secure: secureCookie(),
      path: '/',
      maxAge: REFRESH_MAX_AGE,
    });
  }
  return response;
}

export function clearAuthCookies(response) {
  const base = {
    sameSite: 'lax',
    secure: secureCookie(),
    path: '/',
    maxAge: 0,
  };
  response.cookies.set(ACCESS_COOKIE, '', { ...base, httpOnly: false });
  response.cookies.set(REFRESH_COOKIE, '', { ...base, httpOnly: true });
  response.cookies.set(WORKSPACE_COOKIE, '', { ...base, httpOnly: false });
  return response;
}

/** JSON response that also plants session cookies from an InsForge auth payload. */
export function jsonWithSession(data, init = {}) {
  const response = NextResponse.json(data, { status: init.status ?? 200 });
  applyAuthCookies(response, {
    accessToken: data?.accessToken,
    refreshToken: data?.refreshToken,
  });
  return response;
}
