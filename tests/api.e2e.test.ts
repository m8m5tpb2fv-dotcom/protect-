/**
 * HTTP end-to-end tests against a running server with demo data:
 *   E2E_BASE_URL=http://localhost:3000 npx vitest run tests/api.e2e.test.ts
 * Exercises cookies, CSRF protection, auth guards and the full client ↔ provider flow via the public API.
 */
import { describe, expect, it } from "vitest";

const BASE = process.env.E2E_BASE_URL;
const d = BASE ? describe : describe.skip;

class Client {
  cookie = "";
  async req(path: string, init: { method?: string; body?: unknown; csrf?: boolean } = {}) {
    const headers: Record<string, string> = { origin: BASE! };
    if (init.csrf !== false) headers["x-ryadom"] = "1";
    if (this.cookie) headers.cookie = this.cookie;
    if (init.body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(BASE + path, { method: init.method ?? (init.body !== undefined ? "POST" : "GET"), headers, body: init.body !== undefined ? JSON.stringify(init.body) : undefined, redirect: "manual" });
    const set = res.headers.get("set-cookie");
    if (set?.includes("ryadom_session=")) this.cookie = set.split(";")[0];
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }
}

d("HTTP API (e2e)", () => {
  const client = new Client();
  const provider = new Client();
  let orderId = "";

  it("health", async () => {
    expect((await new Client().req("/api/health")).json.ok).toBe(true);
  });

  it("protects private endpoints and enforces CSRF header", async () => {
    const anon = new Client();
    expect((await anon.req("/api/orders")).status).toBe(401);
    expect((await anon.req("/api/auth/demo", { body: { as: "client" }, csrf: false })).status).toBe(403);
    const cross = await fetch(BASE + "/api/auth/demo", { method: "POST", headers: { "x-ryadom": "1", origin: "https://evil.example", "content-type": "application/json" }, body: '{"as":"client"}' });
    expect(cross.status).toBe(403);
  });

  it("validates input", async () => {
    await client.req("/api/auth/demo", { body: { as: "client" } });
    const bad = await client.req("/api/orders", { body: { subcategoryId: 1, title: "x", description: "y", address: "", urgency: "now" } });
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe("validation");
  });

  it("scenario: create → respond → choose → start → complete → review", async () => {
    const sug = await client.req("/api/search/suggest?q=" + encodeURIComponent("протечка"));
    const svc = sug.json.services[0];
    expect(svc).toBeTruthy();
    const cities = await client.req("/api/cities");
    const district = cities.json.cities.find((c: { slug: string }) => c.slug === "saratov").districts[0];
    const created = await client.req("/api/orders", {
      body: { subcategoryId: 1, title: "E2E: " + svc.name, description: "Капает под раковиной, e2e тест", address: "Саратов, ул. Тестовая, 1", districtId: district.id, urgency: "today", budget: 1500 },
    });
    // subcategory 1 = santehnik in the seeded catalogue
    expect(created.status).toBe(200);
    orderId = created.json.id;

    await provider.req("/api/auth/demo", { body: { as: "provider" } });
    const resp = await provider.req(`/api/orders/${orderId}/respond`, { body: { message: "Приеду через час", price: 1400, eta: "Через час" } });
    expect(resp.status).toBe(200);

    const detail = await client.req(`/api/orders/${orderId}`);
    expect(detail.json.responses.length).toBe(1);
    const choose = await client.req(`/api/orders/${orderId}/action`, { body: { action: "choose", responseId: detail.json.responses[0].id } });
    expect(choose.json.status).toBe("assigned");

    const msg = await client.req(`/api/conversations/${resp.json.conversationId}/messages`, { body: { body: "Жду, домофон 12" } });
    expect(msg.status).toBe(200);
    const provMsgs = await provider.req(`/api/conversations/${resp.json.conversationId}/messages`);
    expect(provMsgs.json.messages.some((m: { body: string }) => m.body === "Жду, домофон 12")).toBe(true);

    expect((await provider.req(`/api/orders/${orderId}/action`, { body: { action: "start" } })).json.status).toBe("in_progress");
    expect((await provider.req(`/api/orders/${orderId}/action`, { body: { action: "complete", finalPrice: 1400 } })).json.status).toBe("completed");
    const review = await client.req(`/api/orders/${orderId}/review`, { body: { rating: 5, text: "Отлично (e2e)" } });
    expect(review.status).toBe(200);

    const notes = await provider.req("/api/notifications");
    expect(notes.json.notifications.some((n: { type: string }) => n.type === "review.new")).toBe(true);
  });

  it("uploads: rejects non-images, accepts a real PNG", async () => {
    const bad = new FormData();
    bad.set("purpose", "order");
    bad.set("file", new Blob(["<script>alert(1)</script>"], { type: "image/png" }), "x.png");
    const r1 = await fetch(BASE + "/api/uploads", { method: "POST", headers: { "x-ryadom": "1", origin: BASE!, cookie: client.cookie }, body: bad });
    expect(r1.status).toBe(400);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
    const good = new FormData();
    good.set("purpose", "order");
    good.set("file", new Blob([png], { type: "image/png" }), "dot.png");
    const r2 = await fetch(BASE + "/api/uploads", { method: "POST", headers: { "x-ryadom": "1", origin: BASE!, cookie: client.cookie }, body: good });
    const j = await r2.json();
    expect(r2.status).toBe(200);
    expect(j.url).toMatch(/^\/files\/order\/.+\.webp$/);
    const file = await fetch(BASE + j.url);
    expect(file.headers.get("content-type")).toBe("image/webp");
    expect((await fetch(BASE + "/files/private/document/x.pdf")).status).toBe(404);
  });
});
