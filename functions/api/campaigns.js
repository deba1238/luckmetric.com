export async function onRequest(context) {
  const { env } = context;

  try {
    // Check for missing environment variables
    if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
      return new Response(
        JSON.stringify([{
          is_error: true,
          message: "Missing SUPABASE_URL or SUPABASE_KEY in Cloudflare Environment Variables. Go to Pages > Settings > Environment Variables."
        }]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    // Fetch campaigns from Supabase (no status filter for Auto campaigns compatibility)
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/campaigns?select=title,platform,original_link,user_luck_coins_text,source_type`,
      {
        method: "GET",
        headers: {
          "apikey": env.SUPABASE_KEY,
          "Authorization": `Bearer ${env.SUPABASE_KEY}`
        }
      }
    );

    const text = await res.text();

    // Handle HTTP errors from Supabase
    if (!res.ok) {
      return new Response(
        JSON.stringify([{
          is_error: true,
          message: `Supabase Error [Status ${res.status}]: ${text}`
        }]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    // Parse JSON response
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return new Response(
        JSON.stringify([{
          is_error: true,
          message: `Invalid JSON from Supabase: ${text.substring(0, 200)}`
        }]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    // Validate data is an array
    if (!Array.isArray(data)) {
      return new Response(
        JSON.stringify([{
          is_error: true,
          message: `Expected an array but received: ${JSON.stringify(data).substring(0, 200)}`
        }]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    // Handle empty table
    if (data.length === 0) {
      return new Response(
        JSON.stringify([{
          is_error: true,
          message: "Connection successful, but the 'campaigns' table in Supabase is completely empty. Please Force Sync from Google Sheets."
        }]),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        }
      );
    }

    // Sort: Manual campaigns first, then Auto campaigns
    data.sort((a, b) => {
      if (a.source_type === "Manual" && b.source_type !== "Manual") return -1;
      if (a.source_type !== "Manual" && b.source_type === "Manual") return 1;
      return 0;
    });

    // Return successful response
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    return new Response(
      JSON.stringify([{
        is_error: true,
        message: `Cloudflare Worker Exception: ${err.message}`
      }]),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  }
}
