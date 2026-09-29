"use client";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const TOKEN_KEY = "ryadom_token";

/** Fallback for environments where cookies are blocked (e.g. Telegram Web in Safari). */
export function setBearerToken(token: string | null) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}
function bearer() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown; signal?: AbortSignal; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { "x-ryadom": "1" };
  const token = bearer();
  if (token) headers.authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method: init.method ?? (body ? "POST" : "GET"), headers, body, signal: init.signal, credentials: "include" });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "network", "Нет соединения. Проверьте интернет и попробуйте снова.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error ?? {};
    throw new ApiError(res.status, err.code ?? "error", err.message ?? "Не удалось выполнить запрос", err.details);
  }
  return json as T;
}

export async function uploadFile(file: File, purpose: string): Promise<{ url: string; width: number; height: number; kind: string }> {
  const form = new FormData();
  form.set("file", file);
  form.set("purpose", purpose);
  return api("/api/uploads", { method: "POST", form });
}
