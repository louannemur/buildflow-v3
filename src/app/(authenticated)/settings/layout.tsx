import { AppLayout } from "@/components/layout/AppLayout";
import { SettingsShell } from "./settings-shell";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      <SettingsShell>{children}</SettingsShell>
    </AppLayout>
  );
}
