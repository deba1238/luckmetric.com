export async function onRequest() {
  return new Response(
    JSON.stringify({ status: "ok", message: "API Routing is perfectly active!" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    }
  );
}
