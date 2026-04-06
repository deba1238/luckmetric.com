export async function onRequest(context) {
    const { env } = context;
    try {
        // &status=eq.Active মুছে ফেলা হয়েছে কারণ অটো ক্যাম্পেইনে status কলাম নেই
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/campaigns?select=title,platform,original_link,user_luck_coins_text,source_type`, {
            headers: { 
                "apikey": env.SUPABASE_KEY, 
                "Authorization": `Bearer ${env.SUPABASE_KEY}` 
            }
        });
        
        let data = await res.json();
        
        // Supabase থেকে Error Object আসলে সাইট যেন ক্র্যাশ না করে তার জন্য সেফটি চেক
        if (!Array.isArray(data)) {
            return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
        }
        
        data.sort((a, b) => {
            if (a.source_type === 'Manual' && b.source_type !== 'Manual') return -1;
            if (a.source_type !== 'Manual' && b.source_type === 'Manual') return 1;
            return 0;
        });
        
        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    } catch (err) { 
        return new Response(JSON.stringify([]), { status: 500, headers: { "Content-Type": "application/json" } }); 
    }
}
