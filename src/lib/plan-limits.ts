export type Plan = "free" | "studio" | "pro" | "founding";

export interface PlanLimits {
  maxProjects: number;
  maxDesigns: number;
  maxPagesPerProject: number;
  maxDesignGenerationsPerDay: number;
  maxProjectTokensPerMonth: number;
  canBuild: boolean;
  canEditCode: boolean;
  canPublish: boolean;
}

const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxProjects: 0,
    maxDesigns: 3,
    maxPagesPerProject: 0,
    maxDesignGenerationsPerDay: 3,
    maxProjectTokensPerMonth: 0,
    canBuild: false,
    canEditCode: false,
    canPublish: false,
  },
  studio: {
    maxProjects: 1,
    maxDesigns: Infinity,
    maxPagesPerProject: 5,
    maxDesignGenerationsPerDay: 30,
    maxProjectTokensPerMonth: 100_000,
    canBuild: false,
    canEditCode: true,
    canPublish: false,
  },
  pro: {
    maxProjects: 15,
    maxDesigns: Infinity,
    maxPagesPerProject: Infinity,
    maxDesignGenerationsPerDay: Infinity,
    maxProjectTokensPerMonth: 2_000_000,
    canBuild: true,
    canEditCode: true,
    canPublish: true,
  },
  founding: {
    maxProjects: 15,
    maxDesigns: Infinity,
    maxPagesPerProject: Infinity,
    maxDesignGenerationsPerDay: Infinity,
    maxProjectTokensPerMonth: 2_000_000,
    canBuild: true,
    canEditCode: true,
    canPublish: true,
  },
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function canCreateProject(plan: Plan): boolean {
  return getPlanLimits(plan).maxProjects > 0;
}
