// ============================================================
// Nexus Data — Refresh Prices Edge Function
// POST /refresh-prices → fetches fresh prices for all active
// assets, upserts price_cache, and returns a summary.
// Stories 3.5 (manual button) & 3.6 (auto-refresh on entry).
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { handleCors } from "../shared/cors.ts";
import { jsonResponse, errorResponse } from "../shared/response.ts";
import { requireAuth } from "../shared/auth.ts";
import { PriceEngine } from "../shared/price-engine/index.ts";
import type { AggregateRequest } from "../shared/price-engine/aggregator.ts";

// Rate limit: max 1 call per 60 seconds (per user)
const RATE_LIMIT_SECONDS = 60;

interface RefreshSummary {
  updated: number;
  failed: number;
  duration_ms: number;
  trigger: string;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== "POST") {
    return errorResponse("method_not_allowed", "Only POST is allowed", 405);
  }

  // ── Auth gate ──
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const { user } = auth;

  // ── Parse body ──
  let trigger = "manual";
  try {
    const body = await req.json();
    if (body.trigger === "auto" || body.trigger === "manual") {
      trigger = body.trigger;
    }
  } catch {
    // Empty body is fine — default to "manual"
  }

  // ── Supabase client scoped to user's JWT ──
  const token = req.headers.get("Authorization")!.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  // ── Rate limit check ──
  const { data: lastRefresh } = await supabase
    .from("price_refresh_log")
    .select("refreshed_at")
    .order("refreshed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRefresh) {
    const elapsed =
      (Date.now() - new Date(lastRefresh.refreshed_at).getTime()) / 1000;
    if (elapsed < RATE_LIMIT_SECONDS) {
      return errorResponse(
        "rate_limited",
        `Rate limited. Try again in ${Math.ceil(RATE_LIMIT_SECONDS - elapsed)}s.`,
        429,
      );
    }
  }

  const startTime = Date.now();

  // ── Fetch active assets ──
  const { data: assets, error: assetsError } = await supabase
    .from("assets")
    .select("ticker, price_source")
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (assetsError) {
    return errorResponse("db_error", assetsError.message, 500);
  }

  if (!assets || assets.length === 0) {
    return jsonResponse({
      updated: 0,
      failed: 0,
      duration_ms: Date.now() - startTime,
      trigger,
    } satisfies RefreshSummary);
  }

  // ── Build price requests ──
  const brapiApiKey = Deno.env.get("BRAPI_API_KEY");
  const exchangeApiKey = Deno.env.get("EXCHANGE_RATE_API_KEY");

  if (!brapiApiKey || !exchangeApiKey) {
    return errorResponse(
      "server_error",
      "Server misconfigured: missing API keys",
      500,
    );
  }

  const engine = new PriceEngine({ brapiApiKey, exchangeApiKey });

  // Map price_source to currency for the aggregator
  const requests: AggregateRequest[] = assets.map((a) => ({
    ticker: a.ticker,
    currency: a.price_source === "crypto" || a.price_source === "exchange"
      ? ("USD" as const)
      : ("BRL" as const),
  }));

  // Deduplicate by ticker (multiple assets may share the same ticker)
  const uniqueRequests = Array.from(
    new Map(requests.map((r) => [r.ticker, r])).values(),
  );

  // ── Fetch prices ──
  let updated = 0;
  let failed = 0;

  try {
    const results = await engine.getPrices(uniqueRequests);

    // ── Upsert into price_cache ──
    for (const result of results) {
      const { error: upsertError } = await supabase
        .from("price_cache")
        .upsert(
          {
            ticker: result.ticker,
            price: result.price_brl,
            currency: result.currency,
            source: "brapi",
            fetched_at: result.timestamp,
            user_id: user.id,
          },
          { onConflict: "ticker" },
        );

      if (upsertError) {
        console.error(
          `[refresh-prices] upsert failed for ${result.ticker}:`,
          upsertError.message,
        );
        failed++;
      } else {
        updated++;
      }
    }

    // Track tickers that were requested but not returned
    const returnedTickers = new Set(results.map((r) => r.ticker));
    for (const req of uniqueRequests) {
      if (!returnedTickers.has(req.ticker)) {
        failed++;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[refresh-prices] engine error:", message);
    return errorResponse("price_error", message, 502);
  }

  // ── Log refresh event ──
  await supabase.from("price_refresh_log").insert({
    refreshed_at: new Date().toISOString(),
    trigger,
  });

  const durationMs = Date.now() - startTime;

  return jsonResponse({
    updated,
    failed,
    duration_ms: durationMs,
    trigger,
  } satisfies RefreshSummary);
});
