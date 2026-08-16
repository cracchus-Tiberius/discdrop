// functions/_middleware.js — canonical-domain redirect.
//
// discdrop.net, www.discdrop.net, discdrop.no, and www.discdrop.no are all
// attached as custom domains on the same Cloudflare Pages project and were
// all serving the exact same site directly as 200 — every page existed on
// 4 hostnames with no redirect between them, relying solely on each page's
// <link rel="canonical"> tag (see app/layout.tsx / generateMetadata calls)
// to tell Google which one actually counts. Canonical tags are a hint, not
// a guarantee, and this is very likely part of why indexed pages dropped
// (933 -> 682) and impressions fell ~40% per Google Search Console
// (16.08.2026 report) — a real redirect is the standard, reliable fix.
//
// Tried this first as a public/_redirects rule with a full https://host/*
// source — confirmed live that Cloudflare Pages' _redirects does NOT
// support cross-hostname matching between custom domains on one project;
// it silently no-ops. Functions middleware runs for every request
// (including static asset serving) regardless of which attached hostname
// received it, so it's the mechanism that actually works here.
//
// discdrop.pages.dev is deliberately NOT redirected — it's the raw
// deployment subdomain used for verifying a deploy before/without the
// custom domain, not a hostname Google indexes or users land on.
const CANONICAL_HOST = 'discdrop.net';
const REDIRECT_HOSTS = new Set(['www.discdrop.net', 'discdrop.no', 'www.discdrop.no']);

export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  if (REDIRECT_HOSTS.has(url.hostname)) {
    url.hostname = CANONICAL_HOST;
    return Response.redirect(url.toString(), 301);
  }
  return next();
}
