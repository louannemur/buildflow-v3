"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Plan = "free" | "studio" | "pro" | "founding";

interface AuthUser {
  id: string;
  plan: Plan;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export function useCurrentUser() {
  const { data: session, status } = useSession();

  return {
    user: session?.user as AuthUser | undefined,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
  };
}

export function useRequireAuth() {
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  return { user, isLoading };
}
