/**
 * How many proxies sit in front of the server (Railway's edge is one; add one more if
 * Cloudflare proxies the API too). The client address is read that many hops from the
 * right end of X-Forwarded-For, which a client cannot fake the way it can fake the left end.
 */
const parsed = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10)
export const TRUST_PROXY_HOPS = Number.isFinite(parsed) && parsed >= 0 ? parsed : 1
