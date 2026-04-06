// ============================================================================
// FILE: functions/api/campaigns.js
// PURPOSE: Fetch all live deals from Supabase campaigns table
// ROUTE: GET /api/campaigns
// CRITICAL: NO status filter — Auto campaigns have no status column
// ============================================================================

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function errorResponse(message) {
  return new Response(
    JSON.stringify([{ is_error: true, message }]),
    { status: 200, headers: CORS_HEADERS }
  );
}

export async function onRequest(context) {
  const { env } = context;

  // Handle CORS preflight
  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    // STEP 1 & 2 — Validate environment variables
    if (!env.SUPABASE_URL || env.SUPABASE_URL.trim() === "") {
      return errorResponse(
        "System Error: SUPABASE_URL is not set in Cloudflare Environment Variables. " +
        "Go to: Cloudflare Dashboard → Pages → Your Project → Settings → Environment Variables"
      );
    }
    if (!env.SUPABASE_KEY || env.SUPABASE_KEY.trim() === "") {
      return errorResponse(
        "System Error: SUPABASE_KEY is not set in Cloudflare Environment Variables. " +
        "Go to: Cloudflare Dashboard → Pages → Your Project → Settings → Environment Variables"
      );
    }

    // STEP 3 — Trim trailing slash from base URL
    const baseUrl = env.SUPABASE_URL.replace(/\/$/, "");

    // STEP 4 — Build fetch URL (NO status filter — critical bug prevention)
    const fetchUrl =
      `${baseUrl}/rest/v1/campaigns` +
      `?select=id,title,platform,original_link,user_luck_coins_text,source_type,expiry_date` +
      `&order=source_type.asc`;

    // STEP 5 — Fetch from Supabase with required headers
    let supabaseResponse;
    try {
      supabaseResponse = await fetch(fetchUrl, {
        method: "GET",
        headers: {
          apikey: env.SUPABASE_KEY,
          Authorization: `Bearer ${env.SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
      });
    } catch (fetchErr) {
      return errorResponse(
        `Network Error reaching Supabase: ${fetchErr.message}. ` +
        "Check if SUPABASE_URL is a valid https:// URL."
      );
    }

    // STEP 6 — Read response as text first (never directly as JSON)
    const rawText = await supabaseResponse.text();

    // STEP 7 — Check HTTP status from Supabase
    if (!supabaseResponse.ok) {
      return errorResponse(
        `Supabase HTTP Error [${supabaseResponse.status}]: ${rawText.substring(0, 300)}`
      );
    }

    // STEP 8 — Try JSON parse
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      return errorResponse(
        `Supabase returned invalid JSON. Raw response: ${rawText.substring(0, 200)}`
      );
    }

    // STEP 9 — Validate array
    if (!Array.isArray(data)) {
      return errorResponse(
        `Expected an array from Supabase, but got: ${typeof data}. ` +
        `Value preview: ${JSON.stringify(data).substring(0, 150)}`
      );
    }

    // STEP 10 — Sort: Manual first, Auto last
    data.sort((a, b) => {
      if (a.source_type === "Manual" && b.source_type !== "Manual") return -1;
      if (a.source_type !== "Manual" && b.source_type === "Manual") return 1;
      return 0;
    });

    // STEP 11 — Return sorted data
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: CORS_HEADERS,
    });

  } catch (err) {
    // STEP 12 — Outer catch for any unexpected Cloudflare exception
    return errorResponse(`Cloudflare Serverless Exception: ${err.message}`);
  }
}
