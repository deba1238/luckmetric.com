export async function onRequest(context) {
  const { env, request } = context;

  try {
    // STEP 1: Get query params
    const url = new URL(request.url);
    const plat = url.searchParams.get('plat');
    const originalUrl = url.searchParams.get('url');

    if (!originalUrl) {
      return new Response(
        JSON.stringify({
          is_error: true,
          message: "Missing 'url' query parameter"
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

    // Validate environment variables
    if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
      return new Response(
        JSON.stringify({
          converted_url: originalUrl,
          method: "passthrough",
          warning: "Missing Supabase credentials"
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

    const baseUrl = env.SUPABASE_URL.replace(/\/$/, '');

    // STEP 2: Fetch from api_settings table
    const platformName = plat || 'unknown';
    const fetchUrl = `${baseUrl}/rest/v1/api_settings?platform_name=eq.${encodeURIComponent(platformName)}&status=eq.Yes&select=api_type,base_url,token`;

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
        JSON.stringify({
          converted_url: originalUrl,
          method: "passthrough",
          warning: `Supabase error: ${rawText}`
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

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      return new Response(
        JSON.stringify({
          converted_url: originalUrl,
          method: "passthrough",
          warning: "Parse error"
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

    // STEP 3 & 4: Check if API setting found
    if (!Array.isArray(data) || data.length === 0) {
      // No matching API setting - return original URL safely
      return new Response(
        JSON.stringify({
          converted_url: originalUrl,
          method: "passthrough",
          platform: platformName
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

    const apiSetting = data[0];

    // STEP 3: If EarnKaro API type
    if (apiSetting.api_type === 'earnkaro' && apiSetting.base_url && apiSetting.token) {
      try {
        // Call EarnKaro API to convert link
        const earnkaroRes = await fetch(apiSetting.base_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiSetting.token}`
          },
          body: JSON.stringify({
            url: originalUrl,
            convert_option: "convert_only"
          })
        });

        const earnkaroData = await earnkaroRes.json();

        if (earnkaroData.data || earnkaroData.short_url) {
          return new Response(
            JSON.stringify({
              converted_url: earnkaroData.data || earnkaroData.short_url,
              method: "earnkaro",
              platform: platformName
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
      } catch (earnkaroErr) {
        console.log(`[go-link] EarnKaro conversion failed: ${earnkaroErr.message}`);
      }
    }

    // STEP 4: Return original URL safely
    return new Response(
      JSON.stringify({
        converted_url: originalUrl,
        method: "passthrough",
        platform: platformName,
        api_type: apiSetting.api_type
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
    // STEP 5: Catch-all fallback
    const url = new URL(request.url);
    const originalUrl = url.searchParams.get('url') || '';

    return new Response(
      JSON.stringify({
        converted_url: originalUrl,
        method: "passthrough",
        error: err.message
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
