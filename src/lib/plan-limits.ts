export type Plan = "free" | "studio" | "pro" | "founding";

export interface PlanLimits {
  maxProjects: number;
  maxDesigns: number;
  maxPagesPerProject: number;
  maxDesignGenerationsPerDay: number;
  maxAiGenerationsPerMonth: number;
  canBuild: boolean;
  canEditCode: boolean;
}

const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxProjects: 0,
    maxDesigns: 3,
    maxPagesPerProject: 0,
    maxDesignGenerationsPerDay: 3,
    maxAiGenerationsPerMonth: 0,
    canBuild: false,
    canEditCode: false,
  },
  studio: {
    maxProjects: 1,
    maxDesigns: Infinity,
    maxPagesPerProject: 5,
    maxDesignGenerationsPerDay: 30,
    maxAiGenerationsPerMonth: 10,
    canBuild: false,
    canEditCode: true,
  },
  pro: {
    maxProjects: 10,
    maxDesigns: Infinity,
    maxPagesPerProject: Infinity,
    maxDesignGenerationsPerDay: Infinity,
    maxAiGenerationsPerMonth: 200,
    canBuild: true,
    canEditCode: true,
  },
  founding: {
    maxProjects: 10,
    maxDesigns: Infinity,
    maxPagesPerProject: Infinity,
    maxDesignGenerationsPerDay: Infinity,
    maxAiGenerationsPerMonth: Infinity,
    canBuild: true,
    canEditCode: true,
  },
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
}

export function canCreateProject(plan: Plan): boolean {
  return getPlanLimits(plan).maxProjects > 0;
}
