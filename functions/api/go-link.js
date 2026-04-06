// ============================================================================
// FILE: functions/api/go-link.js
// PURPOSE: Convert original product URL to affiliate link using api_settings
// ROUTE: GET /api/go-link?plat=amazon&url=https://...
// ============================================================================

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

// Fetch affiliate settings for a given platform from Supabase
async function getApiSettings(baseUrl, apiKey, platform) {
  try {
    const res = await fetch(
      `${baseUrl}/rest/v1/api_settings` +
        `?platform_name=eq.${encodeURIComponent(platform)}` +
        `&status=eq.Yes` +
        `&select=api_type,base_url,token`,
      {
        method: "GET",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) return null;
    const text = await res.text();
    const data = JSON.parse(text);
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch {
    return null;
  }
}

// EarnKaro link conversion (API call)
async function convertViaEarnKaro(earnKaroToken, originalUrl) {
  try {
    const apiEndpoint = `https://api.earnkaro.com/link/convert`;
    const res = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${earnKaroToken}`,
      },
      body: JSON.stringify({ url: originalUrl }),
    });

    if (!res.ok) {
      return { success: false, reason: `EarnKaro HTTP ${res.status}` };
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, reason: "EarnKaro returned invalid JSON" };
    }

    // EarnKaro typically returns { short_url, tracking_url, status }
    const converted =
      data.short_url || data.tracking_url || data.converted_url || null;
    if (converted) {
      return { success: true, converted_url: converted, method: "earnkaro" };
    }
    return { success: false, reason: `No URL in EarnKaro response: ${text.substring(0, 100)}` };
  } catch (err) {
    return { success: false, reason: `EarnKaro Exception: ${err.message}` };
  }
}

// Amazon associate tag append (simple tag injection)
function convertAmazonTag(originalUrl, tag) {
  try {
    const u = new URL(originalUrl);
    u.searchParams.set("tag", tag);
    // Remove irrelevant tracking params that break attribution
    u.searchParams.delete("ref");
    u.searchParams.delete("linkCode");
    return { success: true, converted_url: u.toString(), method: "amazon_tag" };
  } catch {
    return { success: false, reason: "Invalid Amazon URL format" };
  }
}

// vCommission link conversion
async function convertViaVCommission(baseApiUrl, token, originalUrl) {
  try {
    const res = await fetch(`${baseApiUrl}/link/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": token,
      },
      body: JSON.stringify({ url: originalUrl }),
    });
    if (!res.ok) {
      return { success: false, reason: `vCommission HTTP ${res.status}` };
    }
    const text = await res.text();
    const data = JSON.parse(text);
    const converted = data.affiliate_url || data.link || null;
    if (converted) {
      return { success: true, converted_url: converted, method: "vcommission" };
    }
    return { success: false, reason: "No URL in vCommission response" };
  } catch (err) {
    return { success: false, reason: `vCommission Exception: ${err.message}` };
  }
}

export async function onRequest(context) {
  const { env } = context;

  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
      return jsonResponse({
        is_error: true,
        message: "Missing SUPABASE_URL or SUPABASE_KEY environment variables.",
      });
    }

    const baseUrl = env.SUPABASE_URL.replace(/\/$/, "");
    const { searchParams } = new URL(context.request.url);
    const plat = (searchParams.get("plat") || "").trim().toLowerCase();
    const originalUrl = (searchParams.get("url") || "").trim();

    // Validate URL param
    if (!originalUrl) {
      return jsonResponse({ is_error: true, message: "Missing required parameter: url" });
    }
    if (!originalUrl.startsWith("http://") && !originalUrl.startsWith("https://")) {
      return jsonResponse({
        is_error: true,
        message: "Invalid URL. Must start with http:// or https://",
      });
    }

    // Look up active affiliate settings for this platform
    const settings = plat ? await getApiSettings(baseUrl, env.SUPABASE_KEY, plat) : null;

    if (!settings) {
      // No affiliate config found — passthrough the original URL
      return jsonResponse({
        converted_url: originalUrl,
        method: "passthrough",
        reason: `No active affiliate API settings found for platform: ${plat || "unknown"}`,
      });
    }

    const { api_type, base_url: apiBaseUrl, token } = settings;

    // Route to the correct affiliate conversion method
    let result;

    if (api_type === "earnkaro") {
      result = await convertViaEarnKaro(token, originalUrl);
    } else if (api_type === "amazon_tag") {
      result = convertAmazonTag(originalUrl, token);
    } else if (api_type === "vcommission") {
      result = await convertViaVCommission(apiBaseUrl, token, originalUrl);
    } else {
      // Unknown api_type — passthrough
      result = {
        success: true,
        converted_url: originalUrl,
        method: "passthrough",
        reason: `Unknown api_type: ${api_type}`,
      };
    }

    if (result.success) {
      return jsonResponse({
        converted_url: result.converted_url,
        method: result.method,
        platform: plat,
      });
    } else {
      // Conversion failed — return original URL safely
      return jsonResponse({
        converted_url: originalUrl,
        method: "passthrough_fallback",
        reason: result.reason,
        platform: plat,
      });
    }
  } catch (err) {
    return jsonResponse({
      is_error: true,
      message: `go-link Exception: ${err.message}`,
    });
  }
}
