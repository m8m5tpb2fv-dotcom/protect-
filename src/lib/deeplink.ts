/**
 * Telegram deep links. start_param alphabet is [A-Za-z0-9_-], ≤ 512 chars.
 *   provider_<slug>  → /provider/<slug>
 *   order_<uuid>     → /orders/<uuid>
 *   category_<slug>  → /services/<slug>
 *   service_<slug>   → /order/new?service=<slug>
 *   chat_<uuid>      → /messages/<uuid>
 */
export type DeepLinkTarget = { kind: "provider" | "order" | "category" | "service" | "chat"; value: string };

const SAFE = /^[A-Za-z0-9-]{1,200}$/;

export function encodeStartParam(t: DeepLinkTarget) {
  if (!SAFE.test(t.value)) throw new Error("unsafe deep link value");
  return `${t.kind}_${t.value}`;
}

export function decodeStartParam(param: string | null | undefined): string | null {
  if (!param) return null;
  const m = param.match(/^(provider|order|category|service|chat)_([A-Za-z0-9-]{1,200})$/);
  if (!m) return null;
  const [, kind, value] = m;
  switch (kind) {
    case "provider":
      return `/provider/${value}`;
    case "order":
      return `/orders/${value}`;
    case "category":
      return `/services/${value}`;
    case "service":
      return `/order/new?service=${value}`;
    case "chat":
      return `/messages/${value}`;
  }
  return null;
}

/** https://t.me/<bot>/<app>?startapp=<param> — null when the bot isn't configured. */
export function miniAppUrl(bot: string, app: string, t?: DeepLinkTarget) {
  if (!bot) return null;
  const base = `https://t.me/${bot}/${app}`;
  return t ? `${base}?startapp=${encodeStartParam(t)}` : base;
}
