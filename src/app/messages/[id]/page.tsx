import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";
import { conversationAccess, listMessages } from "@/server/services/chat";
import { ChatThread } from "./thread";

export const metadata: Metadata = { title: "Диалог", robots: { index: false } };

export default async function ThreadPage({ params }: PageProps<"/messages/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/messages/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let access: Awaited<ReturnType<typeof conversationAccess>>;
  let messages: Awaited<ReturnType<typeof listMessages>>;
  try {
    access = await conversationAccess(id, user);
    messages = await listMessages(id, user);
  } catch (e) {
    if (e instanceof AppError && (e.status === 403 || e.status === 404)) notFound();
    throw e;
  }
  return (
      <ChatThread
        conversationId={id}
        me={user.id}
        peer={{ name: access.peer.name, avatar: access.peer.avatar, slug: access.peer.slug }}
        order={access.order}
        asRole={access.asRole}
        initial={messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString(), readAt: m.readAt?.toISOString() ?? null }))}
      />
  );
}
