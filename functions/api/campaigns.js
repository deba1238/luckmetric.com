export async function onRequest(context) {
  const { env } = context;
  
  try {
    // Check environment variables
    if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_KEY environment variables" }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Fetch campaigns from Supabase (no status filter for Auto campaigns)
    const res = await fetch(`${env.SUPABASE_URL}/rest/v1/campaigns?select=title,platform,original_link,user_luck_coins_text,source_type`, {
      headers: {
        "apikey": env.SUPABASE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_KEY}`
      }
    });

    const text = await res.text();

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Supabase error ${res.status}: ${text}` }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return new Response(
        JSON.stringify({ error: `Invalid JSON from Supabase: ${text.substring(0, 100)}` }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!Array.isArray(data)) {
      return new Response(
        JSON.stringify({ error: `Expected array, got: ${typeof data}` }),
        { headers: { "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Sort: Manual first, then Auto
    data.sort((a, b) => {
      if (a.source_type === 'Manual' && b.source_type !== 'Manual') return -1;
      if (a.source_type !== 'Manual' && b.source_type === 'Manual') return 1;
      return 0;
    });

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Worker exception: ${err.message}` }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
}
