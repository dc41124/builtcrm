// Minimal Request builder for route handlers that use `await req.json()`.
export function jsonRequest(body: unknown, url = "http://localhost/test"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

export function emptyRequest(url = "http://localhost/test"): Request {
  return new Request(url, { method: "GET" });
}
