export async function onRequest(context) {
    const { env } = context;
    try {
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/campaigns?select=title,platform,original_link,user_luck_coins_text,source_type&status=eq.Active`, {
            headers: { "apikey": env.SUPABASE_KEY, "Authorization": `Bearer ${env.SUPABASE_KEY}` }
        });
        let data = await res.json();
        data.sort((a, b) => {
            if (a.source_type === 'Manual' && b.source_type !== 'Manual') return -1;
            if (a.source_type !== 'Manual' && b.source_type === 'Manual') return 1;
            return 0;
        });
        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    } catch (err) { return new Response(JSON.stringify([]), { status: 500 }); }
}
