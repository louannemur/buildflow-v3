"use client";

interface SidebarProps {
  children: React.ReactNode;
}

export function Sidebar({ children }: SidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-border/50 bg-sidebar md:block">
      <div className="flex h-full flex-col gap-2 p-4">
        {children}
      </div>
    </aside>
  );
}
