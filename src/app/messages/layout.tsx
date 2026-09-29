import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listConversations } from "@/server/services/chat";
import { ConversationList } from "./conversation-list";

export default async function MessagesLayout({ children }: LayoutProps<"/messages">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/messages");
  const list = await listConversations(user);
  return (
    <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-32 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-6 lg:px-6 lg:pb-8 lg:pt-8">
      <ConversationList initial={list} />
      {children}
    </main>
  );
}
