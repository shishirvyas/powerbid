/**
 * Liveness/reachability probe.
 *
 * Used by the offline sync engine to confirm real connectivity before
 * flipping the UI to "online". Must be:
 *   - cheap (no DB calls)
 *   - public (no auth) — the HEAD must succeed even on the login screen
 *   - cache-busted via the client's `cache: 'no-store'`
 *
 * Returns 200 with no body for both GET and HEAD.
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
