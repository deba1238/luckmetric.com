export async function onRequest(context) {
    const { request, env } = context;
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    try {
        const body = await request.json();
        const { action, email, password, name } = body;
        const hash = btoa(password); 

        if (action === "signup") {
            const res = await fetch(`${env.SUPABASE_URL}/rest/v1/users`, {
                method: "POST",
                headers: { "apikey": env.SUPABASE_KEY, "Authorization": `Bearer ${env.SUPABASE_KEY}`, "Content-Type": "application/json", "Prefer": "return=minimal" },
                body: JSON.stringify({ email: email.toLowerCase(), password_hash: hash, name })
            });
            if (!res.ok) return new Response(JSON.stringify({ error: "Email already exists" }), { status: 400 });
            return new Response(JSON.stringify({ success: true, email: email.toLowerCase(), name }));
        }
        if (action === "login") {
            const res = await fetch(`${env.SUPABASE_URL}/rest/v1/users?email=eq.${email.toLowerCase()}&password_hash=eq.${hash}&select=name,email`, {
                headers: { "apikey": env.SUPABASE_KEY, "Authorization": `Bearer ${env.SUPABASE_KEY}` }
            });
            const data = await res.json();
            if (data.length > 0) return new Response(JSON.stringify({ success: true, user: data[0] }));
            return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
        }
    } catch (e) { return new Response(JSON.stringify({ error: "Server error" }), { status: 500 }); }
}
