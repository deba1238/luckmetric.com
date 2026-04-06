export async function onRequest(context) {
  const { request } = context;

  try {
    // Parse URL params
    const { searchParams } = new URL(request.url);
    const plat = searchParams.get('plat');
    const url = searchParams.get('url');

    // Validate: if no url param
    if (!url) {
      return new Response(
        JSON.stringify({
          is_error: true,
          message: "Missing 'url' parameter"
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

    // Validate: url must start with http:// or https://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return new Response(
        JSON.stringify({
          is_error: true,
          message: "Invalid URL format. Must start with http:// or https://"
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

    // Log for Cloudflare dashboard visibility
    console.log(`[/go] plat=${plat} → ${url}`);

    // Perform redirect
    return Response.redirect(url, 302);

  } catch (err) {
    return new Response(
      JSON.stringify({
        is_error: true,
        message: `Redirect exception: ${err.message}`
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
