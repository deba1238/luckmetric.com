export async function onRequest(context) {
    const { request, env } = context;
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    try {
        const body = await request.json();
        const { action, email, order_id, platform, coins, method, address } = body;

        if (action === "get_data") {
            const res = await fetch(`${env.SUPABASE_URL}/rest/v1/users?email=eq.${email.toLowerCase()}&select=approved_balance,pending_balance,premium_status`, {
                headers: { "apikey": env.SUPABASE_KEY, "Authorization": `Bearer ${env.SUPABASE_KEY}` }
            });
            const data = await res.json();
            return new Response(JSON.stringify(data[0] || { approved_balance: 0, pending_balance: 0 }));
        }
        if (action === "submit_order") {
            await fetch(`${env.SUPABASE_URL}/rest/v1/user_submissions`, {
                method: "POST",
                headers: { "apikey": env.SUPABASE_KEY, "Authorization": `Bearer ${env.SUPABASE_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ user_email: email.toLowerCase(), order_id, platform, verification_status: "Pending", timestamp: new Date().toISOString() })
            });
            return new Response(JSON.stringify({ success: true }));
        }
        if (action === "withdraw") {
            await fetch(`${env.SUPABASE_URL}/rest/v1/withdrawals`, {
                method: "POST",
                headers: { "apikey": env.SUPABASE_KEY, "Authorization": `Bearer ${env.SUPABASE_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ user_email: email.toLowerCase(), coins_redeemed: coins, payout_method: method, wallet_address: address, status: "Pending", created_at: new Date().toISOString() })
            });
            return new Response(JSON.stringify({ success: true }));
        }
    } catch (e) { return new Response(JSON.stringify({ error: "Server error" }), { status: 500 }); }
}
