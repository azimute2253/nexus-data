// ============================================================
// Nexus Data — Asset Types Edge Function
// GET  /asset-types → list user's asset types (auth required)
// POST /asset-types → create a new asset type (auth required)
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../shared/cors.ts";
import { jsonResponse, errorResponse } from "../shared/response.ts";
import { requireAuth } from "../shared/auth.ts";

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // ── Auth gate ──
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  // ── Supabase client scoped to user's JWT ──
  const token = req.headers.get("Authorization")!.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    },
  );

  // ── GET: list asset types ──
  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("asset_types")
      .select("*")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (error) {
      return errorResponse("db_error", error.message, 500);
    }

    return jsonResponse(data);
  }

  // ── POST: create asset type ──
  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse("bad_request", "Invalid JSON body", 400);
    }

    const { name, target_pct } = body as { name?: string; target_pct?: number };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return errorResponse("validation_error", "name is required (non-empty string)", 400);
    }

    // Get next sort_order
    const { data: existing, error: countError } = await supabase
      .from("asset_types")
      .select("sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: false })
      .limit(1);

    if (countError) {
      return errorResponse("db_error", countError.message, 500);
    }

    const nextOrder = existing && existing.length > 0
      ? (existing[0].sort_order ?? 0) + 1
      : 0;

    const { data, error } = await supabase
      .from("asset_types")
      .insert({
        name: name.trim(),
        target_pct: typeof target_pct === "number" ? target_pct : null,
        sort_order: nextOrder,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      return errorResponse("db_error", error.message, 500);
    }

    return jsonResponse(data, 201);
  }

  return errorResponse("method_not_allowed", "Only GET and POST are allowed", 405);
});
