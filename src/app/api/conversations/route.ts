import { api, body } from "@/server/http/handler";
import { startConversationSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import { listConversations, startConversation } from "@/server/services/chat";

export const GET = api(async () => ({ conversations: await listConversations(await requireUser()) }));

export const POST = api(async (req) => {
  const { providerId, orderId, body: text } = await body(req, startConversationSchema);
  return { id: await startConversation(await requireUser(), providerId, orderId, text) };
});
