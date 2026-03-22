// ============================================================
// Nexus Data — Health Check Edge Function
// GET /health → { status: "ok", timestamp }
// ============================================================

import { handleCors } from "../shared/cors.ts";
import { jsonResponse, errorResponse } from "../shared/response.ts";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "GET") {
    return errorResponse("method_not_allowed", "Only GET is allowed", 405);
  }

  return jsonResponse({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});
