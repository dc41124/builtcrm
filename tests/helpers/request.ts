// Minimal Request builder for route handlers that use `await req.json()`.
export function jsonRequest(body: unknown, url = "http://localhost/test"): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

// Same as jsonRequest, but with caller-controlled method. Used by Step 52
// safety-forms tests for PATCH + PUT routes.
export function jsonRequestWithMethod(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body: unknown,
  url = "http://localhost/test",
): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

export function emptyRequest(url = "http://localhost/test"): Request {
  return new Request(url, { method: "GET" });
}
