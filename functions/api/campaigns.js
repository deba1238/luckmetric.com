export async function onRequest(context) {
    const { env } = context;
    
    // CRITICAL: Always return JSON headers, even in error cases
    const jsonHeaders = { "Content-Type": "application/json" };
    
    try {
        // Check for missing environment variables
        if (!env.SUPABASE_URL || !env.SUPABASE_KEY) {
            return new Response(JSON.stringify([{ 
                is_error: true, 
                message: "Missing SUPABASE_URL or SUPABASE_KEY in Cloudflare Environment Variables. Go to Pages > Settings > Environment Variables." 
            }]), { headers: jsonHeaders });
        }

        // Fetch from Supabase
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1/campaigns?select=title,platform,original_link,user_luck_coins_text,source_type`, {
            method: 'GET',
            headers: { 
                "apikey": env.SUPABASE_KEY, 
                "Authorization": `Bearer ${env.SUPABASE_KEY}`
            }
        });
        
        const text = await res.text();

        // Handle HTTP errors from Supabase
        if (!res.ok) {
            return new Response(JSON.stringify([{ 
                is_error: true, 
                message: `Supabase Error [Status ${res.status}]: ${text}` 
            }]), { headers: jsonHeaders });
        }

        // Parse JSON response
        let data;
        try {
            data = JSON.parse(text);
        } catch(e) {
            return new Response(JSON.stringify([{ 
                is_error: true, 
                message: `Invalid JSON from Supabase: ${text.substring(0, 150)}` 
            }]), { headers: jsonHeaders });
        }

        // Validate data is an array
        if (!Array.isArray(data)) {
            return new Response(JSON.stringify([{ 
                is_error: true, 
                message: `Expected an array but received: ${JSON.stringify(data).substring(0, 150)}` 
            }]), { headers: jsonHeaders });
        }

        // Handle empty table
        if (data.length === 0) {
            return new Response(JSON.stringify([{ 
                is_error: true, 
                message: `Connection successful, but the 'campaigns' table in Supabase is completely empty. Please Force Sync from Google Sheets.` 
            }]), { headers: jsonHeaders });
        }
        
        // Sort: Manual campaigns first, then Auto campaigns
        data.sort((a, b) => {
            if (a.source_type === 'Manual' && b.source_type !== 'Manual') return -1;
            if (a.source_type !== 'Manual' && b.source_type === 'Manual') return 1;
            return 0;
        });
        
        // Return successful response
        return new Response(JSON.stringify(data), { headers: jsonHeaders });

    } catch (err) { 
        // Catch-all for any unexpected errors
        return new Response(JSON.stringify([{ 
            is_error: true, 
            message: `Cloudflare Worker Exception: ${err.message}` 
        }]), { headers: jsonHeaders }); 
    }
}
