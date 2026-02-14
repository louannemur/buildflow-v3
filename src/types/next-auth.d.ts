import "next-auth";
import "next-auth/jwt";

type Plan = "free" | "studio" | "pro" | "founding";

declare module "next-auth" {
  interface User {
    plan?: Plan;
  }

  interface Session {
    user: {
      id: string;
      plan: Plan;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    plan?: Plan;
  }
}
