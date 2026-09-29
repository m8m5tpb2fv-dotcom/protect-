import { z } from "zod";
import { api, body, query } from "@/server/http/handler";
import { messageSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { listMessages, sendChatMessage } from "@/server/services/chat";
import { db } from "@/server/db";
import { messages } from "@/server/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";

/** Polling endpoint: ?after=<iso> returns only newer messages + ids of own messages the peer has read. */
export const GET = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const { after } = query(req, z.object({ after: z.string().max(40).optional() }));
  const items = await listMessages(id, user, { after });
  const read = await db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.conversationId, id), eq(messages.senderId, user.id), isNotNull(messages.readAt)));
  return { messages: items, readIds: read.map((r) => r.id) };
});

export const POST = api<{ id: string }>(
  async (req, { id }) => {
    const m = await sendChatMessage(id, await requireUser(), await body(req, messageSchema));
    return { message: m };
  },
  { rate: { limit: 40, windowMs: 60_000, key: "chat-send" } },
);
