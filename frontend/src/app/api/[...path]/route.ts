import { forwardToGateway, gatewayUrlFromEnv } from '@/server/gateway-proxy';

// Every /api/* call from the browser goes to the gateway through this one route.
async function handler(request: Request): Promise<Response> {
  return forwardToGateway(request, { gatewayUrl: gatewayUrlFromEnv() });
}

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT };
