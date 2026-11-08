import { connection } from 'next/server';
import { gatewayUrlFromEnv } from '@/server/gateway-proxy';
import { siteHealth } from '@/server/health';

// GET /api/health for uptime monitors: 200 when the whole path to the backend works, else 503.
// This route wins over the /api/* proxy route, so the gateway never sees it.
export async function GET(): Promise<Response> {
  // Checked on every request, never prerendered.
  await connection();
  return siteHealth(gatewayUrlFromEnv());
}
