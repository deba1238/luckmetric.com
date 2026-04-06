export async function onRequest(context) {
    const { env } = context;
    try {
        if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
            return new Response(JSON.stringify([{ 
                is_error: true, 
                message: "Missing SUPABASE_URL or SUPABASE_KEY in Cloudflare Environment Variables." 
            }]), { headers: { "Content-Type": "application/json" } });
        }

        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/campaigns?select=title,platform,original_link,user_luck_coins_text,source_type`, {
            headers: { 
                "apikey": env.SUPABASE_KEY, 
                "Authorization": `Bearer ${env.SUPABASE_KEY}` 
            }
        });
        
        const text = await res.text();

        if (!res.ok) {
            return new Response(JSON.stringify([{ 
                is_error: true, 
                message: `Supabase Error [Status ${res.status}]: ${text}` 
            }]), { headers: { "Content-Type": "application/json" } });
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch(e) {
            return new Response(JSON.stringify([{ 
                is_error: true, 
                message: `Invalid JSON from Supabase: ${text.substring(0, 150)}` 
            }]), { headers: { "Content-Type": "application/json" } });
        }

        if (!Array.isArray(data)) {
            return new Response(JSON.stringify([{ 
                is_error: true, 
                message: `Expected an array but received: ${JSON.stringify(data).substring(0, 150)}` 
            }]), { headers: { "Content-Type": "application/json" } });
        }

        if (data.length === 0) {
            return new Response(JSON.stringify([{ 
                is_error: true, 
                message: `Connection successful, but the 'campaigns' table in Supabase is completely empty. Please Force Sync from Google Sheets.` 
            }]), { headers: { "Content-Type": "application/json" } });
        }
        
        data.sort((a, b) => {
            if (a.source_type === 'Manual' && b.source_type !== 'Manual') return -1;
            if (a.source_type !== 'Manual' && b.source_type === 'Manual') return 1;
            return 0;
        });
        
        return new Response(JSON.stringify(data), { 
            headers: { "Content-Type": "application/json" } 
        });

    } catch (err) { 
        return new Response(JSON.stringify([{ 
            is_error: true, 
            message: `Cloudflare Worker Exception: ${err.message}` 
        }]), { headers: { "Content-Type": "application/json" } }); 
    }
}
