export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const platform = (url.searchParams.get("plat") || "").toLowerCase();
    let targetUrl = url.searchParams.get("url");

    if (!targetUrl) return Response.redirect("https://luckmetric.com", 302);

    try {
        const ruleRes = await fetch(`${env.SUPABASE_URL}/rest/v1/affiliate_rules?platform=ilike.%${platform}%&is_active=eq.true&select=network,commission_rate`, {
            headers: { "apikey": env.SUPABASE_KEY, "Authorization": `Bearer ${env.SUPABASE_KEY}` }
        });
        const rules = await ruleRes.json();

        let bestNetwork = "earnkaro"; 
        let maxRate = -1;

        if (rules && rules.length > 0) {
            rules.forEach(r => {
                if (r.commission_rate > maxRate) {
                    maxRate = r.commission_rate;
                    bestNetwork = r.network.toLowerCase();
                }
            });
        }

        const apiRes = await fetch(`${env.SUPABASE_URL}/rest/v1/api_settings?platform_name=ilike.%${bestNetwork}%&status=eq.Yes`, {
            headers: { "apikey": env.SUPABASE_KEY, "Authorization": `Bearer ${env.SUPABASE_KEY}` }
        });
        const apis = await apiRes.json();
        const apiData = apis.length > 0 ? apis[0] : null;

        let finalUrl = targetUrl;
        if (apiData && apiData.method === 'POST' && apiData.auth_type === 'Bearer') {
            const convRes = await fetch(apiData.base_url, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiData.token}` },
                body: JSON.stringify({ url: targetUrl, convert_option: "convert_only" })
            });
            const convData = await convRes.json();
            if (convData.data || convData.short_url) finalUrl = convData.data || convData.short_url;
        } 
        else if (apiData && apiData.auth_type === 'QueryParam') {
            finalUrl = `https://track.vcommission.com/click?url=${encodeURIComponent(targetUrl)}`;
        }

        return Response.redirect(finalUrl, 302);
    } catch (err) { return Response.redirect(targetUrl, 302); }
}
