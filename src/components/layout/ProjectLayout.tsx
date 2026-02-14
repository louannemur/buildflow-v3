"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import {
  Settings,
  CreditCard,
  LogOut,
  Moon,
  Sun,
  Monitor,
  Menu,
  PanelLeftClose,
  PanelLeft,
  Lightbulb,
  GitBranch,
  FileText,
  Palette,
  Hammer,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useCurrentUser } from "@/hooks/useAuth";
import { useAppStore } from "@/stores/app-store";
import { useProjectStore } from "@/stores/project-store";
import { cn } from "@/lib/utils";

// ─── Project context ──────────────────────────────────────────────────────────

type ProjectStep = "features" | "flows" | "pages" | "designs" | "build";

interface ProjectItem {
  id: string;
  title: string;
}

export interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  currentStep: ProjectStep;
  features: ProjectItem[];
  userFlows: ProjectItem[];
  pages: ProjectItem[];
  designs: ProjectItem[];
}

interface ProjectContextValue {
  project: ProjectData;
  activeStep: ProjectStep;
  setActiveStep: (step: ProjectStep) => void;
  activeItemId: string | null;
  setActiveItemId: (id: string | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProjectContext() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProjectContext must be used within ProjectLayout");
  }
  return ctx;
}

// ─── Sidebar step config ──────────────────────────────────────────────────────

const steps: {
  key: ProjectStep;
  label: string;
  icon: typeof Lightbulb;
  itemsKey: keyof Pick<ProjectData, "features" | "userFlows" | "pages" | "designs">;
}[] = [
  { key: "features", label: "Features", icon: Lightbulb, itemsKey: "features" },
  { key: "flows", label: "User Flows", icon: GitBranch, itemsKey: "userFlows" },
  { key: "pages", label: "Pages & Content", icon: FileText, itemsKey: "pages" },
  { key: "designs", label: "Designs", icon: Palette, itemsKey: "designs" },
];

const buildStep = { key: "build" as const, label: "Build", icon: Hammer };

// ─── User menu (shared with AppLayout pattern) ───────────────────────────────

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function UserMenu() {
  const { user } = useCurrentUser();
  const { setTheme, theme } = useTheme();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 rounded-full"
        >
          <Avatar size="sm">
            <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? ""} />
            <AvatarFallback className="text-xs">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/settings/profile")}>
            <Settings />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/settings/billing")}>
            <CreditCard />
            Billing
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {theme === "dark" ? <Moon /> : theme === "light" ? <Sun /> : <Monitor />}
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor />
              System
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  project,
  activeStep,
  onStepClick,
  activeItemId,
  onItemClick,
}: {
  project: ProjectData;
  activeStep: ProjectStep;
  onStepClick: (step: ProjectStep) => void;
  activeItemId: string | null;
  onItemClick: (step: ProjectStep, itemId: string) => void;
}) {
  // Read live data from the store for sidebar items
  const storeProject = useProjectStore((s) => s.project);
  const storeFeatures = useProjectStore((s) => s.features);
  const storeUserFlows = useProjectStore((s) => s.userFlows);
  const storePages = useProjectStore((s) => s.pages);
  const storeDesigns = useProjectStore((s) => s.designs);

  const displayName = storeProject?.name ?? project.name;
  const displayDesc = storeProject?.description ?? project.description;

  // Build live sidebar items from store, falling back to static prop
  const liveItems: Record<string, ProjectItem[]> = {
    features: storeFeatures.length > 0
      ? storeFeatures.map((f) => ({ id: f.id, title: f.title }))
      : project.features,
    userFlows: storeUserFlows.length > 0
      ? storeUserFlows.map((f) => ({ id: f.id, title: f.title }))
      : project.userFlows,
    pages: storePages.length > 0
      ? storePages.map((p) => ({ id: p.id, title: p.title }))
      : project.pages,
    designs: storeDesigns.length > 0
      ? storeDesigns.map((d) => ({ id: d.id, title: d.name }))
      : project.designs,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Project header */}
      <div className="border-b border-border/50 p-4">
        <div className="group flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold leading-tight">
              {displayName}
            </h2>
            {displayDesc && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {displayDesc}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-xs"
            className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
            title="Edit project"
          >
            <Pencil />
          </Button>
        </div>
      </div>

      {/* Step navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-0.5">
          {steps.map((step) => {
            const Icon = step.icon;
            const items = liveItems[step.itemsKey] ?? project[step.itemsKey];
            const isActive = activeStep === step.key;

            return (
              <Collapsible key={step.key} open={isActive}>
                <CollapsibleTrigger asChild>
                  <button
                    onClick={() => onStepClick(step.key)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate text-left">
                      {step.label}
                    </span>
                    {items.length > 0 && (
                      <ChevronRight
                        className={cn(
                          "size-3.5 shrink-0 text-muted-foreground/50 transition-transform duration-200",
                          isActive && "rotate-90"
                        )}
                      />
                    )}
                  </button>
                </CollapsibleTrigger>
                {items.length > 0 && (
                  <CollapsibleContent>
                    <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/50 pl-2.5">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => onItemClick(step.key, item.id)}
                          className={cn(
                            "flex w-full items-center rounded-md px-2 py-1 text-xs transition-colors",
                            activeItemId === item.id
                              ? "bg-primary/10 font-medium text-primary"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                          )}
                        >
                          <span className="truncate">{item.title}</span>
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                )}
              </Collapsible>
            );
          })}

          {/* Build step (no items) */}
          <button
            onClick={() => onStepClick(buildStep.key)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              activeStep === buildStep.key
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
            )}
          >
            <Hammer className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">{buildStep.label}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

// ─── ProjectLayout ────────────────────────────────────────────────────────────

export function ProjectLayout({
  project,
  children,
}: {
  project: ProjectData;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Derive active step from the current URL path
  const pathSegments = pathname.split("/");
  const lastSegment = pathSegments[pathSegments.length - 1];
  const stepFromPath = ["features", "flows", "pages", "designs", "build"].includes(lastSegment)
    ? (lastSegment as ProjectStep)
    : null;

  const [activeStep, setActiveStepState] = useState<ProjectStep>(
    stepFromPath ?? project.currentStep
  );
  const [activeItemId, setActiveItemId] = useState<string | null>(
    searchParams.get("item")
  );

  // Keep activeStep in sync when URL changes
  if (stepFromPath && stepFromPath !== activeStep) {
    setActiveStepState(stepFromPath);
  }

  // Extract the base project path (e.g. /project/abc123)
  const projectBasePath = pathname.match(/^\/project\/[^/]+/)?.[0] ?? pathname;

  const setActiveStep = useCallback(
    (step: ProjectStep) => {
      setActiveStepState(step);
      setActiveItemId(null);
      router.push(`${projectBasePath}/${step}`);
    },
    [projectBasePath, router]
  );

  const handleItemClick = useCallback(
    (step: ProjectStep, itemId: string) => {
      setActiveStepState(step);
      setActiveItemId(itemId);
      router.push(`${projectBasePath}/${step}?item=${itemId}`);
      setMobileOpen(false);
    },
    [projectBasePath, router]
  );

  const handleStepClick = useCallback(
    (step: ProjectStep) => {
      setActiveStep(step);
      setMobileOpen(false);
    },
    [setActiveStep]
  );

  return (
    <ProjectContext.Provider
      value={{
        project,
        activeStep,
        setActiveStep,
        activeItemId,
        setActiveItemId,
      }}
    >
      <div className="flex min-h-svh flex-col">
        {/* Top navbar */}
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="flex h-14 items-center px-4 sm:px-6">
            {/* Mobile sidebar toggle */}
            <div className="mr-2 md:hidden">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon-sm">
                    <Menu className="size-5" />
                    <span className="sr-only">Project menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0" showCloseButton={false}>
                  <SheetHeader className="sr-only">
                    <SheetTitle>Project navigation</SheetTitle>
                  </SheetHeader>
                  <SidebarContent
                    project={project}
                    activeStep={activeStep}
                    onStepClick={handleStepClick}
                    activeItemId={activeItemId}
                    onItemClick={handleItemClick}
                  />
                </SheetContent>
              </Sheet>
            </div>

            {/* Desktop sidebar toggle */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="mr-2 hidden md:inline-flex"
              onClick={toggleSidebar}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="size-4" />
              ) : (
                <PanelLeft className="size-4" />
              )}
            </Button>

            {/* Logo */}
            <Link href="/home" className="mr-4 shrink-0">
              <span className="text-lg font-bold tracking-tight">
                Build<span className="text-primary">Flow</span>
              </span>
            </Link>

            {/* Breadcrumb-style project name */}
            <div className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
              <Link
                href="/projects"
                className="transition-colors hover:text-foreground"
              >
                Projects
              </Link>
              <ChevronRight className="size-3.5" />
              <span className="max-w-[200px] truncate font-medium text-foreground">
                {project.name}
              </span>
            </div>

            {/* User menu */}
            <div className="ml-auto">
              <UserMenu />
            </div>
          </div>
        </header>

        <div className="flex flex-1">
          {/* Desktop sidebar */}
          <aside
            className={cn(
              "hidden shrink-0 border-r border-border/50 bg-sidebar transition-[width] duration-200 ease-in-out md:block",
              sidebarOpen ? "w-60" : "w-0 overflow-hidden border-r-0"
            )}
          >
            <div className="sticky top-14 h-[calc(100svh-3.5rem)] w-60">
              <SidebarContent
                project={project}
                activeStep={activeStep}
                onStepClick={handleStepClick}
                activeItemId={activeItemId}
                onItemClick={handleItemClick}
              />
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </ProjectContext.Provider>
  );
}
