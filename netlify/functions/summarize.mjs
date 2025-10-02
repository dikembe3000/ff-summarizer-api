// netlify/functions/summarize.mjs
// Netlify Functions use the Web Fetch API. This file is an ES module.

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,           // set to your GitHub Pages origin for stricter security
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export default async (req, context) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders("*") });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders("*") });
  }

  const OPENAI_API_KEY = Netlify.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return new Response("Server misconfigured: missing OPENAI_API_KEY", { status: 500, headers: corsHeaders("*") });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const items = Array.isArray(body.items) ? body.items.slice(0, 10) : [];

  // Build a tight prompt from titles/links to keep token use low
  const prompt = [
    "Summarize the *fantasy football impact* of these recent articles.",
    "Group bullets by themes: Injuries, Transactions, Depth Chart/Usage, Waivers, Start/Sit.",
    "Keep it brief. Finish with 3 actionable takeaways.",
    "Articles:",
    ...items.map((it, i) => `(${i + 1}) ${it.title || "Untitled"} — ${it.link || it.url || ""}`)
  ].join("\n");

  // Call OpenAI Responses API
  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      temperature: 0.4
    })
  });

  if (!resp.ok) {
    const text = await resp.text();
    return new Response("Summarizer error: " + text, { status: 500, headers: { ...corsHeaders("*"), "content-type": "text/plain; charset=utf-8" } });
  }

  const data = await resp.json();
  const text = data.output_text || "No summary returned.";
  return new Response(text, { headers: { ...corsHeaders("*"), "content-type": "text/plain; charset=utf-8" } });
};
