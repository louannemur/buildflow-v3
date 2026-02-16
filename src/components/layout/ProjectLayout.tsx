"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  ChevronDown,
  ArrowLeft,
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
  activeStep: ProjectStep | null;
  setActiveStep: (step: ProjectStep) => void;
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
  { key: "flows", label: "User Flow", icon: GitBranch, itemsKey: "userFlows" },
  { key: "pages", label: "Content", icon: FileText, itemsKey: "pages" },
  { key: "designs", label: "Design", icon: Palette, itemsKey: "designs" },
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
  onOverviewClick,
}: {
  project: ProjectData;
  activeStep: ProjectStep | null;
  onStepClick: (step: ProjectStep) => void;
  onOverviewClick: () => void;
}) {
  // Read live data from the store for sidebar items
  const storeProject = useProjectStore((s) => s.project);
  const storeFeatures = useProjectStore((s) => s.features);
  const storeUserFlows = useProjectStore((s) => s.userFlows);
  const storePages = useProjectStore((s) => s.pages);
  const storeDesigns = useProjectStore((s) => s.designs);

  const displayName = storeProject?.name ?? project.name;

  // Track which step is expanded (independent of active/navigation)
  const [expandedStep, setExpandedStep] = useState<ProjectStep | null>(activeStep);
  const [lastSyncedStep, setLastSyncedStep] = useState<ProjectStep | null>(activeStep);

  // Only force-expand when activeStep actually changes to a new value
  if (activeStep !== lastSyncedStep) {
    setLastSyncedStep(activeStep);
    if (activeStep) {
      setExpandedStep(activeStep);
    }
  }

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
    designs: storePages.length > 0
      ? storePages.map((p) => ({ id: p.id, title: p.title }))
      : project.pages,
  };

  function handleStepToggle(step: ProjectStep) {
    if (expandedStep === step) {
      // Already expanded — collapse it
      setExpandedStep(null);
    } else {
      // Expand this step and navigate to it
      setExpandedStep(step);
      onStepClick(step);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Back to projects */}
      <div className="px-4 pt-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Back to Projects
        </Link>
      </div>

      {/* Project name */}
      <div className="px-4 pb-1.5 pt-2">
        <button
          onClick={onOverviewClick}
          className="group flex w-full items-center justify-between text-left"
        >
          <h2 className={cn(
            "truncate text-sm font-bold leading-tight",
            activeStep === null && "text-primary",
          )}>
            {displayName}
          </h2>
        </button>
      </div>

      {/* Step navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pt-0.5">
        <div>
          {steps.map((step) => {
            const items = liveItems[step.itemsKey] ?? project[step.itemsKey];
            const isActive = activeStep === step.key;
            const isExpanded = expandedStep === step.key;

            return (
              <Collapsible
                key={step.key}
                open={isExpanded && items.length > 0}
                onOpenChange={() => handleStepToggle(step.key)}
              >
                <div className="border-b border-primary/15">
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "flex w-full items-center justify-between rounded-md px-2 py-2.5 text-sm font-semibold transition-colors",
                        isActive
                          ? "bg-primary/8 text-primary"
                          : "text-foreground hover:text-primary"
                      )}
                    >
                      <span className="truncate">
                        {step.label}
                      </span>
                      {isExpanded && items.length > 0 ? (
                        <ChevronDown className="size-3.5 shrink-0 text-primary" />
                      ) : (
                        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  {items.length > 0 && (
                    <CollapsibleContent>
                      <div className="space-y-0.5 pb-2 pl-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex w-full items-center rounded-md px-2 py-1.5 text-xs text-muted-foreground"
                          >
                            <span className="truncate">{item.title}</span>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  )}
                </div>
              </Collapsible>
            );
          })}

          {/* Build step (no items) */}
          <div className="border-b border-primary/15">
            <button
              onClick={() => onStepClick(buildStep.key)}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-2.5 text-sm font-semibold transition-colors",
                activeStep === buildStep.key
                  ? "bg-primary/8 text-primary"
                  : "text-foreground hover:text-primary"
              )}
            >
              <span className="truncate">{buildStep.label}</span>
              <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />
            </button>
          </div>
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
  const router = useRouter();
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Derive active step from the current URL path
  const pathSegments = pathname.split("/");
  const lastSegment = pathSegments[pathSegments.length - 1];
  const stepFromPath = ["features", "flows", "pages", "designs", "build"].includes(lastSegment)
    ? (lastSegment as ProjectStep)
    : null;

  // null = overview page (base project URL with no step segment)
  const isBasePath = /^\/project\/[^/]+$/.test(pathname);
  const [activeStep, setActiveStepState] = useState<ProjectStep | null>(
    stepFromPath ?? (isBasePath ? null : project.currentStep)
  );
  // Keep activeStep in sync when URL changes
  if (isBasePath && activeStep !== null) {
    setActiveStepState(null);
  } else if (stepFromPath && stepFromPath !== activeStep) {
    setActiveStepState(stepFromPath);
  }

  // Extract the base project path (e.g. /project/abc123)
  const projectBasePath = pathname.match(/^\/project\/[^/]+/)?.[0] ?? pathname;

  // Prefetch all step routes for instant navigation
  useEffect(() => {
    for (const step of ["features", "flows", "pages", "designs", "build"]) {
      router.prefetch(`${projectBasePath}/${step}`);
    }
  }, [projectBasePath, router]);

  const setActiveStep = useCallback(
    (step: ProjectStep) => {
      setActiveStepState(step);
      router.push(`${projectBasePath}/${step}`);
    },
    [projectBasePath, router]
  );

  const goToOverview = useCallback(() => {
    setActiveStepState(null);
    router.push(projectBasePath);
  }, [projectBasePath, router]);

  const handleStepClick = useCallback(
    (step: ProjectStep) => {
      setActiveStep(step);
      setMobileOpen(false);
    },
    [setActiveStep]
  );

  const handleOverviewClick = useCallback(() => {
    goToOverview();
    setMobileOpen(false);
  }, [goToOverview]);

  return (
    <ProjectContext.Provider
      value={{
        project,
        activeStep,
        setActiveStep,
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
                    onOverviewClick={handleOverviewClick}
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
                Calypso
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
                onOverviewClick={handleOverviewClick}
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
