// v71 #38 -- the one way client code calls the API and finds out whether it
// worked.
//
// The old pattern was `await fetch(...)` with the result ignored, so a
// failed save looked exactly like a successful one: the form closed, the
// list refreshed with the OLD data, and the person's changes were silently
// gone. requestJson makes failure impossible to overlook:
//   * checks res.ok and THROWS on anything but 2xx,
//   * parses the JSON body when there is one (empty bodies are fine),
//   * throws a RequestError carrying { message, status, data } where
//     `message` is already person-readable (the server's own error text
//     when it sent one, otherwise a plain-language fallback),
//   * turns a network failure (offline, DNS, server down) into the same
//     kind of error instead of an unhandled rejection.
//
//   try {
//     const data = await requestJson("/api/x", { method: "POST", body: { a: 1 } });
//   } catch (err) {
//     toast.error(err.message);       // err.status is 0 for a network failure
//   }
//
// `body` may be a plain object (sent as JSON), a string, or FormData (sent
// as-is, letting the browser set the multipart boundary).

export class RequestError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.data = data;
  }
}

const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

function fallbackMessage(status) {
  if (status === 401) return "You've been signed out. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That couldn't be found. It may have been removed.";
  if (status === 409) return "That conflicts with something that already exists.";
  if (status === 413) return "That file is too large.";
  if (status === 429) return "Too many tries. Wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our end. Please try again.";
  return "That didn't work. Please try again.";
}

export async function requestJson(url, options = {}) {
  const { body, headers, ...rest } = options;
  const init = { ...rest, headers: { ...(headers || {}) } };

  if (body !== undefined && body !== null) {
    const isForm = typeof FormData !== "undefined" && body instanceof FormData;
    if (isForm || typeof body === "string") {
      init.body = body;
    } else {
      init.body = JSON.stringify(body);
      if (!Object.keys(init.headers).some((h) => h.toLowerCase() === "content-type")) {
        init.headers["Content-Type"] = "application/json";
      }
    }
  }

  let res;
  try {
    res = await fetch(url, init);
  } catch {
    throw new RequestError(NETWORK_MESSAGE, 0, null);
  }

  let data = null;
  try {
    const text = await res.text();
    if (text) data = JSON.parse(text);
  } catch {
    data = null; // non-JSON body (e.g. an HTML error page from a proxy)
  }

  if (!res.ok) {
    const message = typeof data?.error === "string" && data.error.trim() ? data.error : fallbackMessage(res.status);
    throw new RequestError(message, res.status, data);
  }
  return data ?? {};
}

// For code that only needs a message out of whatever was thrown.
export function errorMessage(err, fallback = "That didn't work. Please try again.") {
  return err instanceof RequestError || (err && typeof err.message === "string" && err.message) ? err.message : fallback;
}
