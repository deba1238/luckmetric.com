export async function onRequest(context) {
  const { env, request } = context;

  try {
    // Get query param
    const url = new URL(request.url);
    const q = url.searchParams.get('q');

    if (!q || q.trim() === '') {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    // Validate environment variables
    if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
      return new Response(
        JSON.stringify([{
          is_error: true,
          message: "Missing SUPABASE_URL or SUPABASE_KEY in Cloudflare Environment Variables."
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

    const baseUrl = env.SUPABASE_URL.replace(/\/$/, '');

    // Fetch all campaigns (no status filter)
    const fetchUrl = `${baseUrl}/rest/v1/campaigns?select=id,title,platform,original_link,user_luck_coins_text,source_type,expiry_date`;

    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        "apikey": env.SUPABASE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const rawText = await res.text();

    if (!res.ok) {
      return new Response(
        JSON.stringify([{
          is_error: true,
          message: `Supabase HTTP Error ${res.status}: ${rawText}`
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

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      return new Response(
        JSON.stringify([{
          is_error: true,
          message: `Parse failed: ${rawText.slice(0, 200)}`
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

    if (!Array.isArray(data)) {
      return new Response(
        JSON.stringify([{
          is_error: true,
          message: `Expected array, got: ${typeof data}`
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

    // Filter in JavaScript (NOT in Supabase query)
    const searchTerm = q.toLowerCase().trim();
    const filtered = data.filter(item =>
      (item.title && item.title.toLowerCase().includes(searchTerm)) ||
      (item.platform && item.platform.toLowerCase().includes(searchTerm))
    );

    return new Response(JSON.stringify(filtered), {
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
        message: `Exception: ${err.message}`
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
