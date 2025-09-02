// Netlify Edge Function: Reverse proxy to your Printify shop (hide Printify branding).
// >>> IMPORTANT: Change UPSTREAM to YOUR actual *.printify.me shop URL. <<<

const UPSTREAM = "https://vaultfiber-xrp.printify.me"; // e.g. https://your-shop.printify.me

function forwardHeaders(reqHeaders: Headers) {
  const h = new Headers(reqHeaders);
  const upstreamHost = new URL(UPSTREAM).host;
  h.set("Host", upstreamHost);
  h.set("Origin", UPSTREAM);
  h.set("Referer", UPSTREAM + "/");
  // Optional: drop cookies if needed
  // h.delete("cookie");
  return h;
}

// Remove obvious Printify traces in the HTML (keep conservative so we don't break scripts)
function cleanHtml(html: string) {
  return html
    .replace(/Powered by\s*Printify/gi, "")
    .replace(/content="Printify"/gi, 'content=""')
    .replace(/<a[^>]*href="https?:\/\/printify\.com[^"]*"[^>]*>.*?<\/a>/gis, "");
}

export default async (req: Request) => {
  const reqUrl = new URL(req.url);

  // Build upstream request URL (same path + query)
  const target = new URL(UPSTREAM);
  target.pathname = reqUrl.pathname;
  target.search = reqUrl.search;

  const upstreamRes = await fetch(target.toString(), {
    method: req.method,
    headers: forwardHeaders(req.headers),
    body: ["GET", "HEAD"].includes(req.method) ? undefined : await req.arrayBuffer(),
    redirect: "manual"
  });

  const ct = upstreamRes.headers.get("content-type") || "";

  // Non-HTML: stream through (JS, CSS, images, etc.)
  if (!ct.includes("text/html")) {
    const passthrough = new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: upstreamRes.headers
    });
    passthrough.headers.set("server", "");
    return passthrough;
  }

  // HTML: clean branding and return
  const html = await upstreamRes.text();
  const cleaned = cleanHtml(html);

  const res = new Response(cleaned, {
    status: upstreamRes.status,
    headers: upstreamRes.headers
  });

  res.headers.set("content-type", "text/html; charset=utf-8");
  res.headers.delete("content-encoding"); // avoid gzip mismatch
  res.headers.set("server", "");
  return res;
};

// Bind to all routes
export const config = { path: "/*" };
