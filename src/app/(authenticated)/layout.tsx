import { AIAvatarButton } from "@/components/features/ai-avatar-button";
import { GeneralChatPanel } from "@/components/features/general-chat-panel";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <AIAvatarButton />
      <GeneralChatPanel />
    </>
  );
}
