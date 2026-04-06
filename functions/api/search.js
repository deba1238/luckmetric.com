export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    if (!query) return new Response(JSON.stringify({ error: "Query missing" }), { status: 400 });

    try {
        const siteRes = await fetch(`${env.SUPABASE_URL}/rest/v1/allowed_search_sites?status=eq.Active&select=domain`, {
            headers: { "apikey": env.SUPABASE_KEY, "Authorization": `Bearer ${env.SUPABASE_KEY}` }
        });
        const allowedSitesRaw = await siteRes.json();
        const allowedSites = allowedSitesRaw.map(s => s.domain.toLowerCase());

        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " price in india")}`;
        const scrapeRes = await fetch(ddgUrl, {
            headers: { 
                "User-Agent": request.headers.get("User-Agent") || "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "X-Forwarded-For": request.headers.get("CF-Connecting-IP") || "1.1.1.1"
            }
        });
        const html = await scrapeRes.text();

        const queryTokens = query.toLowerCase().split(' ').filter(t => t.length > 1);
        const requiredNumbers = queryTokens.filter(t => /\d/.test(t)); 

        const results = [];
        const resultBlockRegex = /<a class="result__url" href="([^"]+)">([^<]+)<\/a>.*?<a class="result__snippet[^>]+>(.*?)<\/a>/gs;
        
        let match;
        while ((match = resultBlockRegex.exec(html)) !== null) {
            let link = match[1];
            let domain = match[2].trim().toLowerCase();
            let snippet = match[3].toLowerCase();
            
            if(snippet.includes("out of stock") || snippet.includes("currently unavailable")) continue;

            let isAllowed = allowedSites.some(site => domain.includes(site));
            if (!isAllowed) continue;

            let titleSnippetText = (domain + " " + snippet).toLowerCase();
            let numberMatched = true;

            requiredNumbers.forEach(num => {
                let regex = new RegExp(`\\b${num}\\b`);
                if(!regex.test(titleSnippetText)) numberMatched = false;
            });
            if(!numberMatched) continue; 

            let matchedTokens = 0;
            queryTokens.forEach(t => { if (titleSnippetText.includes(t)) matchedTokens++; });
            if ((matchedTokens / queryTokens.length) < 0.6) continue;

            let priceMatch = snippet.match(/(?:₹|rs\.?)\s*([\d,]+)/i);
            let price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, "")) : null;

            if (price) {
                let platName = domain.split('.')[0]; 
                results.push({ platform: platName, price: price, link: link });
            }
        }

        let platformsData = {};
        results.forEach(r => {
            if (!platformsData[r.platform] || platformsData[r.platform].price > r.price) {
                platformsData[r.platform] = { price: r.price, link: r.link };
            }
        });

        return new Response(JSON.stringify({
            status: Object.keys(platformsData).length > 0 ? "success" : "failed",
            platforms: platformsData
        }), { headers: { "Content-Type": "application/json" } });

    } catch (err) { return new Response(JSON.stringify({ status: "error" }), { status: 500 }); }
}
