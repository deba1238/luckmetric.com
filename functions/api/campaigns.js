export async function onRequest(context) {
  const { env } = context;

  try {
    // STEP 2: Validate environment variables
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

    // STEP 3: Trim trailing slash from SUPABASE_URL
    const baseUrl = env.SUPABASE_URL.replace(/\/$/, '');

    // STEP 4: Build fetch URL (NO status filter)
    const fetchUrl = `${baseUrl}/rest/v1/campaigns?select=id,title,platform,original_link,user_luck_coins_text,source_type,expiry_date`;

    // STEP 5: Fetch from Supabase
    const res = await fetch(fetchUrl, {
      method: "GET",
      headers: {
        "apikey": env.SUPABASE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_KEY}`,
        "Content-Type": "application/json"
      }
    });

    // STEP 6: Read response as text first
    const rawText = await res.text();

    // STEP 7: Handle HTTP errors
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

    // STEP 8: Try JSON parse
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

    // STEP 9: Validate array
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

    // STEP 10: Sort - Manual first, Auto last
    data.sort((a, b) => {
      if (a.source_type === 'Manual' && b.source_type !== 'Manual') return -1;
      if (a.source_type !== 'Manual' && b.source_type === 'Manual') return 1;
      return 0;
    });

    // STEP 11: Return sorted JSON array
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    // STEP 12: Outer catch
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
