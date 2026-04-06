export async function onRequest(context) {
  const { env } = context;

  try {
    const supabaseUrlSet = !!env.SUPABASE_URL;
    const supabaseKeySet = !!env.SUPABASE_KEY;

    return new Response(
      JSON.stringify({
        status: "ok",
        message: "LuckMetric API is Live!",
        routing: "Cloudflare Functions Active",
        supabase_url_set: supabaseUrlSet,
        supabase_key_set: supabaseKeySet,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        status: "error",
        message: `Health check exception: ${err.message}`,
        timestamp: new Date().toISOString()
      }),
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
