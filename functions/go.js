// ============================================================================
// FILE: functions/go.js
// PURPOSE: Smart affiliate redirect — converts and redirects to affiliate URL
// ROUTE: GET /go?plat=amazon&url=https://...
// ============================================================================

export async function onRequest(context) {
  const { env } = context;

  const { searchParams } = new URL(context.request.url);
  const plat = (searchParams.get("plat") || "").trim().toLowerCase();
  const rawUrl = (searchParams.get("url") || "").trim();

  // Validate URL parameter exists
  if (!rawUrl) {
    return new Response(
      JSON.stringify({ is_error: true, message: "Missing required parameter: url" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // Validate URL format (must be a real http/https URL)
  if (!rawUrl.startsWith("http://") && !rawUrl.startsWith("https://")) {
    return new Response(
      JSON.stringify({
        is_error: true,
        message: `Invalid URL format: "${rawUrl.substring(0, 80)}". Must begin with https://`,
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  // Log to Cloudflare dashboard (visible in Pages > Functions > Logs)
  console.log(`[/go] plat=${plat} → ${rawUrl}`);

  // Try to get affiliate-converted link from go-link API
  let finalUrl = rawUrl;

  try {
    if (env.SUPABASE_URL && env.SUPABASE_KEY) {
      const goLinkUrl =
        new URL(context.request.url).origin +
        `/api/go-link?plat=${encodeURIComponent(plat)}&url=${encodeURIComponent(rawUrl)}`;

      const goLinkRes = await fetch(goLinkUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (goLinkRes.ok) {
        const goLinkText = await goLinkRes.text();
        const goLinkData = JSON.parse(goLinkText);
        if (goLinkData.converted_url && !goLinkData.is_error) {
          finalUrl = goLinkData.converted_url;
          console.log(`[/go] Affiliate link resolved via ${goLinkData.method}: ${finalUrl}`);
        }
      }
    }
  } catch (err) {
    // If go-link fails for any reason, fall back to original URL
    console.warn(`[/go] go-link conversion failed, using original: ${err.message}`);
    finalUrl = rawUrl;
  }

  // 302 redirect to final URL
  return Response.redirect(finalUrl, 302);
}
