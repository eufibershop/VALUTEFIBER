const UPSTREAM = "https://netlify/edge-functions/proxy.ts


function forwardHeaders(reqHeaders) {
  const h = new Headers(reqHeaders);
  h.set("Host", new URL(UPSTREAM).host);
  h.set("Origin", UPSTREAM);
  h.set("Referer", UPSTREAM + "/");
  return h;
}

function cleanHtml(html) {
  return html
    .replace(/Powered by\s*Printify/gi, "")
    .replace(/content="Printify"/gi, 'content=""')
    .replace(/<a[^>]*href="https?:\/\/printify\.com[^"]*"[^>]*>.*?<\/a>/gis, "");
}

export default async (req) => {
  const reqUrl = new URL(req.url);
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
  if (!ct.includes("text/html")) {
    const resp = new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers: upstreamRes.headers
    });
    resp.headers.set("server", "");
    return resp;
  }

  const html = await upstreamRes.text();
  const cleaned = cleanHtml(html);

  const res = new Response(cleaned, {
    status: upstreamRes.status,
    headers: upstreamRes.headers
  });

  res.headers.set("content-type", "text/html; charset=utf-8");
  res.headers.delete("content-encoding");
  res.headers.set("server", "");
  return res;
};

export const config = { path: "/*" };
