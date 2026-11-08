/**
 * The site's health, for uptime monitors: up only when this web server reaches a gateway that is
 * ready (the gateway checks its own dependencies). The answer is just "ok" or "unavailable", so it
 * tells a visitor nothing about the setup.
 */
export async function siteHealth(gatewayUrl: string, timeoutMs = 3_000): Promise<Response> {
  let ready = false;
  try {
    const response = await fetch(new URL('/readyz', gatewayUrl), {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    ready = response.ok;
  } catch {
    // Unreachable or too slow: reported as unavailable below.
  }
  return Response.json(
    { status: ready ? 'ok' : 'unavailable' },
    { status: ready ? 200 : 503, headers: { 'cache-control': 'no-store' } },
  );
}
