import { z } from "zod";
import { api, body } from "@/server/http/handler";
import { requireAdmin } from "@/server/auth/session";
import { runAdminAction, type AdminActionInput } from "@/server/services/admin";

const verification = z.enum(["none", "verified", "pro", "business"]);
const schema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("provider.approve"), id: z.string().uuid(), verification: verification.optional() }),
  z.object({ type: z.literal("provider.reject"), id: z.string().uuid(), note: z.string().trim().min(3).max(500) }),
  z.object({ type: z.literal("provider.suspend"), id: z.string().uuid(), note: z.string().trim().max(500).optional() }),
  z.object({ type: z.literal("provider.verification"), id: z.string().uuid(), verification }),
  z.object({ type: z.literal("user.block"), id: z.string().uuid(), blocked: z.boolean() }),
  z.object({ type: z.literal("user.role"), id: z.string().uuid(), role: z.enum(["user", "moderator", "admin"]) }),
  z.object({ type: z.literal("review.visibility"), id: z.string().uuid(), status: z.enum(["visible", "hidden"]) }),
  z.object({ type: z.literal("report.resolve"), id: z.string().uuid(), status: z.enum(["resolved", "rejected"]), resolution: z.string().max(500).optional() }),
  z.object({ type: z.literal("ticket.answer"), id: z.string().uuid(), answer: z.string().trim().min(2).max(4000), close: z.boolean().optional() }),
  z.object({ type: z.literal("order.cancel"), id: z.string().uuid(), reason: z.string().trim().min(3).max(300) }),
  z.object({ type: z.literal("promo.create"), code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,30}$/), discountPct: z.number().int(), maxUses: z.number().int().positive().nullish(), validUntil: z.string().nullish() }),
  z.object({ type: z.literal("promo.toggle"), id: z.number().int(), isActive: z.boolean() }),
  z.object({ type: z.literal("city.toggle"), id: z.number().int(), isActive: z.boolean() }),
  z.object({ type: z.literal("district.create"), cityId: z.number().int(), name: z.string().trim().min(2).max(60), slug: z.string().regex(/^[a-z0-9-]{2,40}$/), lat: z.number(), lng: z.number() }),
  z.object({ type: z.literal("category.update"), id: z.number().int(), name: z.string().trim().min(2).max(60).optional(), isActive: z.boolean().optional(), sortOrder: z.number().int().optional(), description: z.string().max(200).optional() }),
  z.object({ type: z.literal("subcategory.create"), categoryId: z.number().int(), name: z.string().trim().min(2).max(60), namePlural: z.string().trim().min(2).max(60), slug: z.string().regex(/^[a-z0-9-]{2,40}$/), icon: z.string().regex(/^[A-Za-z0-9]{2,40}$/), keywords: z.string().max(500).optional() }),
  z.object({ type: z.literal("subcategory.toggle"), id: z.number().int(), isActive: z.boolean() }),
  z.object({ type: z.literal("content.update"), key: z.string().regex(/^[a-z0-9._-]{2,60}$/), title: z.string().trim().min(1).max(200), body: z.string().max(4000), isActive: z.boolean() }),
]);

export const POST = api(async (req) => {
  const admin = await requireAdmin();
  await runAdminAction(admin, (await body(req, schema)) as AdminActionInput);
  return { ok: true };
});
