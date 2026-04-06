// ============================================================================
// FILE: functions/api/health.js
// PURPOSE: Diagnostic endpoint — verify routing and env vars are alive
// ROUTE: GET /api/health
// ============================================================================

export async function onRequest(context) {
  const { env } = context;

  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabaseUrlSet = !!(env.SUPABASE_URL && env.SUPABASE_URL.trim() !== "");
  const supabaseKeySet = !!(env.SUPABASE_KEY && env.SUPABASE_KEY.trim() !== "");

  const payload = {
    status: "ok",
    message: "LuckMetric API is Live!",
    routing: "Cloudflare Pages Functions Active",
    supabase_url_set: supabaseUrlSet,
    supabase_key_set: supabaseKeySet,
    supabase_url_preview: supabaseUrlSet
      ? env.SUPABASE_URL.replace(/^(https:\/\/[^.]{4})[^.]+/, "$1****")
      : "NOT SET",
    timestamp: new Date().toISOString(),
    region: context.request.cf ? context.request.cf.colo : "unknown",
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: corsHeaders,
  });
}
