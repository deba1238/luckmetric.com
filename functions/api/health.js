export async function onRequest() {
  return new Response(JSON.stringify({ status: "ok", message: "Functions are working!" }), {
    headers: { "Content-Type": "application/json" }
  });
}
