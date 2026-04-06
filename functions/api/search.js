// ============================================================================
// FILE: functions/api/search.js
// PURPOSE: Global Price Comparison & History Engine
//   - Keyword search: filters campaigns by title/platform
//   - URL input: parses product slug, fetches price history from Supabase
//   - Returns: current prices, price_history array, metadata
// ROUTE: GET /api/search?q=...
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

// Detect if the input string is a URL or a keyword search
function isUrl(input) {
  try {
    const u = new URL(input);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Extract a searchable product identifier from a product URL
function extractProductSlug(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname;

    // Amazon: /dp/ASIN or /gp/product/ASIN
    const amazonMatch = path.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    if (amazonMatch) {
      return { platform: "amazon", productId: amazonMatch[1], slug: amazonMatch[1] };
    }

    // Flipkart: /p/pid=... or itm in path
    const flipkartPid = u.searchParams.get("pid");
    if (flipkartPid) {
      return { platform: "flipkart", productId: flipkartPid, slug: flipkartPid };
    }
    const flipkartPath = path.split("/").filter(Boolean);
    if (host.includes("flipkart") && flipkartPath.length >= 2) {
      return {
        platform: "flipkart",
        productId: flipkartPath[flipkartPath.length - 1],
        slug: flipkartPath[flipkartPath.length - 1],
      };
    }

    // Myntra: /product-name/buy/pid/
    const myntraMatch = path.match(/\/(\d{7,})\//);
    if (myntraMatch) {
      return { platform: "myntra", productId: myntraMatch[1], slug: myntraMatch[1] };
    }

    // Meesho
    if (host.includes("meesho")) {
      const parts = path.split("/").filter(Boolean);
      return {
        platform: "meesho",
        productId: parts[parts.length - 1] || path,
        slug: parts[parts.length - 1] || path,
      };
    }

    // Generic fallback: use last path segment
    const parts = path.split("/").filter(Boolean);
    return {
      platform: host,
      productId: parts[parts.length - 1] || path,
      slug: parts[parts.length - 1] || path,
    };
  } catch {
    return { platform: "unknown", productId: rawUrl, slug: rawUrl };
  }
}

// Fetch price history for a product from Supabase price_history table
async function fetchPriceHistory(baseUrl, apiKey, productId, platform) {
  try {
    const thirtyDaysAgo = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    let historyUrl =
      `${baseUrl}/rest/v1/price_history` +
      `?product_id=eq.${encodeURIComponent(productId)}` +
      `&recorded_at=gte.${thirtyDaysAgo}` +
      `&select=product_id,platform,price,recorded_at` +
      `&order=recorded_at.asc` +
      `&limit=90`;

    if (platform && platform !== "unknown") {
      historyUrl += `&platform=eq.${encodeURIComponent(platform)}`;
    }

    const res = await fetch(historyUrl, {
      method: "GET",
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) return [];
    const text = await res.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Fetch allowed search sites from Supabase
async function fetchAllowedSites(baseUrl, apiKey) {
  try {
    const res = await fetch(
      `${baseUrl}/rest/v1/allowed_search_sites?status=eq.Active&select=domain`,
      {
        method: "GET",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) return [];
    const text = await res.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.map((r) => r.domain) : [];
  } catch {
    return [];
  }
}

// Search campaigns from Supabase (keyword match)
async function searchCampaigns(baseUrl, apiKey, keyword) {
  try {
    // Fetch all campaigns then filter in JS (avoids Supabase ilike issues)
    const res = await fetch(
      `${baseUrl}/rest/v1/campaigns` +
        `?select=id,title,platform,original_link,user_luck_coins_text,source_type,expiry_date`,
      {
        method: "GET",
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) return [];
    const text = await res.text();
    const all = JSON.parse(text);
    if (!Array.isArray(all)) return [];

    const q = keyword.toLowerCase();
    return all.filter(
      (item) =>
        (item.title || "").toLowerCase().includes(q) ||
        (item.platform || "").toLowerCase().includes(q)
    );
  } catch {
    return [];
  }
}

// Build price comparison metadata from price history
function buildPriceMetadata(priceHistory) {
  if (!priceHistory || priceHistory.length === 0) {
    return { lowest_ever: null, highest_ever: null, is_lowest_now: false, trend: "unknown" };
  }

  const prices = priceHistory.map((p) => p.price).filter((p) => typeof p === "number");
  if (prices.length === 0) {
    return { lowest_ever: null, highest_ever: null, is_lowest_now: false, trend: "unknown" };
  }

  const lowestEver = Math.min(...prices);
  const highestEver = Math.max(...prices);
  const currentPrice = prices[prices.length - 1];
  const isLowestNow = currentPrice <= lowestEver;

  // Trend: compare last 7 days vs previous 7 days
  let trend = "stable";
  if (prices.length >= 14) {
    const recent = prices.slice(-7);
    const prior = prices.slice(-14, -7);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const priorAvg = prior.reduce((a, b) => a + b, 0) / prior.length;
    if (recentAvg < priorAvg * 0.97) trend = "dropping";
    else if (recentAvg > priorAvg * 1.03) trend = "rising";
  }

  return {
    lowest_ever: lowestEver,
    highest_ever: highestEver,
    current_price: currentPrice,
    is_lowest_now: isLowestNow,
    trend,
  };
}

export async function onRequest(context) {
  const { env } = context;

  if (context.request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    // Validate env
    if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
      return errorResponse(
        "Missing SUPABASE_URL or SUPABASE_KEY in Cloudflare Environment Variables."
      );
    }

    const baseUrl = env.SUPABASE_URL.replace(/\/$/, "");
    const { searchParams } = new URL(context.request.url);
    const q = (searchParams.get("q") || "").trim();

    // No query → return empty
    if (!q) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // ── URL MODE ──────────────────────────────────────────────────
    if (isUrl(q)) {
      const { platform, productId } = extractProductSlug(q);

      // Fetch price history from Supabase
      const priceHistory = await fetchPriceHistory(
        baseUrl,
        env.SUPABASE_KEY,
        productId,
        platform
      );

      const metadata = buildPriceMetadata(priceHistory);

      // Also look for any matching campaigns with the same URL
      let relatedCampaigns = [];
      try {
        const campRes = await fetch(
          `${baseUrl}/rest/v1/campaigns` +
            `?original_link=eq.${encodeURIComponent(q)}` +
            `&select=id,title,platform,original_link,user_luck_coins_text,source_type,expiry_date`,
          {
            method: "GET",
            headers: {
              apikey: env.SUPABASE_KEY,
              Authorization: `Bearer ${env.SUPABASE_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
        if (campRes.ok) {
          const campText = await campRes.text();
          const campData = JSON.parse(campText);
          if (Array.isArray(campData)) relatedCampaigns = campData;
        }
      } catch {}

      const result = {
        mode: "url",
        product_id: productId,
        platform,
        original_url: q,
        price_history: priceHistory,
        metadata,
        related_campaigns: relatedCampaigns,
      };

      return new Response(JSON.stringify([result]), {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // ── KEYWORD MODE ──────────────────────────────────────────────
    const [campaigns, allowedSites] = await Promise.all([
      searchCampaigns(baseUrl, env.SUPABASE_KEY, q),
      fetchAllowedSites(baseUrl, env.SUPABASE_KEY),
    ]);

    // For each campaign result, try to fetch its price history
    const enriched = await Promise.all(
      campaigns.slice(0, 20).map(async (campaign) => {
        // Use a sanitized slug of the title as product_id fallback
        const productId = (campaign.id || campaign.title || q)
          .toString()
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .substring(0, 60);

        const priceHistory = await fetchPriceHistory(
          baseUrl,
          env.SUPABASE_KEY,
          productId,
          campaign.platform
        );

        return {
          ...campaign,
          mode: "keyword",
          price_history: priceHistory,
          metadata: buildPriceMetadata(priceHistory),
          allowed_platforms: allowedSites,
        };
      })
    );

    return new Response(JSON.stringify(enriched), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (err) {
    return errorResponse(`Search Engine Exception: ${err.message}`);
  }
}
