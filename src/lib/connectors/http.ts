import { asRecord } from "./types";
function requiresGoogleProductionAccess(data: unknown): boolean {
  // SearchStream errors can be an array. Keep provider text out of public errors.
  return (Array.isArray(data) ? data : [data]).some(chunk => {
    const details = asRecord(asRecord(chunk).error).details;
    return Array.isArray(details) && details.some(detail => {
      const errors = asRecord(detail).errors;
      return Array.isArray(errors) && errors.some(value => {
        const row = asRecord(value), code = asRecord(row.errorCode).authorizationError;
        return code === "CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION" || (code === "ACTION_NOT_PERMITTED"
          && typeof row.message === "string" && row.message.startsWith("The Google Cloud project is only approved for use with test accounts."));
      });
    });
  });
}
export async function fetchJson(url: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetcher(url, { ...init, redirect: "error", cache: "no-store", signal: init.signal ?? AbortSignal.timeout(30_000) });
    } catch { throw new Error("network_timeout"); }
    let data: unknown;
    try { data = await response.json(); }
    catch { throw new Error(response.ok ? "invalid_response" : `upstream_${response.status}`); }
    if (response.status === 403 && new URL(url).hostname === "googleads.googleapis.com" && requiresGoogleProductionAccess(data)) throw new Error("google_production_access_required");
    const error = asRecord(asRecord(data).error);
    if (response.status === 401 || error.code === 190 || asRecord(data).error === "invalid_grant") throw new Error("token_invalid");
    const rateLimited = response.status === 429 || [4, 17, 80004].includes(Number(error.code));
    if (rateLimited && attempt === 0) {
      const seconds = Math.min(60, Math.max(1, Number(response.headers.get("retry-after")) || 60));
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
      continue;
    }
    if (!response.ok || asRecord(data).error) throw new Error(rateLimited ? "rate_limited" : `upstream_${response.status}`);
    return data;
  }
  throw new Error("rate_limited");
}
