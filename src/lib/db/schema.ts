import {
  pgTable,
  text,
  timestamp,
  primaryKey,
  integer,
  uuid,
  boolean,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Users ──────────────────────────────────────────────────────────────────

export type UserPreferences = {
  theme: "system" | "light" | "dark";
  language: "en";
  highContrast: boolean;
  largeText: boolean;
  reduceAnimations: boolean;
  emailNotifications: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  language: "en",
  highContrast: false,
  largeText: false,
  reduceAnimations: false,
  emailNotifications: true,
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  preferences: jsonb("preferences")
    .$type<UserPreferences>()
    .notNull()
    .default(DEFAULT_PREFERENCES),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  subscription: one(subscriptions),
  usage: many(usage),
  projects: many(projects),
  designs: many(designs),
  savedComponents: many(savedComponents),
  chatConversations: many(chatConversations),
}));

// ─── Accounts (NextAuth) ────────────────────────────────────────────────────

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

// ─── Sessions (NextAuth) ────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ─── Verification Tokens (NextAuth) ─────────────────────────────────────────

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ─── Subscriptions ──────────────────────────────────────────────────────────

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  plan: text("plan", {
    enum: ["free", "studio", "pro", "founding"],
  })
    .notNull()
    .default("free"),
  status: text("status", {
    enum: ["active", "canceled", "past_due", "trialing"],
  })
    .notNull()
    .default("active"),
  currentPeriodStart: timestamp("current_period_start", { mode: "date" }),
  currentPeriodEnd: timestamp("current_period_end", { mode: "date" }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

// ─── Usage ──────────────────────────────────────────────────────────────────

export const usage = pgTable(
  "usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // "2026-02"
    designGenerations: integer("design_generations").notNull().default(0),
    aiGenerations: integer("ai_generations").notNull().default(0),
    projectsCreated: integer("projects_created").notNull().default(0),
    designsSaved: integer("designs_saved").notNull().default(0),
    dailyDesignDate: text("daily_design_date"),
    dailyDesignCount: integer("daily_design_count").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [unique().on(t.userId, t.period)],
);

export const usageRelations = relations(usage, ({ one }) => ({
  user: one(users, {
    fields: [usage.userId],
    references: [users.id],
  }),
}));

// ─── Projects ───────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  thumbnail: text("thumbnail"),
  currentStep: text("current_step", {
    enum: ["features", "flows", "pages", "designs", "build"],
  })
    .notNull()
    .default("features"),
  status: text("status", {
    enum: ["active", "completed", "archived"],
  })
    .notNull()
    .default("active"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  features: many(features),
  userFlows: many(userFlows),
  pages: many(pages),
  designs: many(designs),
  buildConfig: one(buildConfigs),
  buildOutputs: many(buildOutputs),
  publishedSite: one(publishedSites),
  chatConversations: many(chatConversations),
}));

// ─── Features ───────────────────────────────────────────────────────────────

export const features = pgTable("features", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const featuresRelations = relations(features, ({ one }) => ({
  project: one(projects, {
    fields: [features.projectId],
    references: [projects.id],
  }),
}));

// ─── User Flows ─────────────────────────────────────────────────────────────

export type FlowStep = {
  id: string;
  title: string;
  description: string;
  type: string;
};

export const userFlows = pgTable("user_flows", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  steps: jsonb("steps").$type<FlowStep[]>().notNull().default([]),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const userFlowsRelations = relations(userFlows, ({ one }) => ({
  project: one(projects, {
    fields: [userFlows.projectId],
    references: [projects.id],
  }),
}));

// ─── Pages ──────────────────────────────────────────────────────────────────

export type PageContent = {
  id: string;
  name: string;
  description: string;
};

export const pages = pgTable("pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  contents: jsonb("contents").$type<PageContent[]>(),
  order: integer("order").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const pagesRelations = relations(pages, ({ one, many }) => ({
  project: one(projects, {
    fields: [pages.projectId],
    references: [projects.id],
  }),
  designs: many(designs),
}));

// ─── Designs ────────────────────────────────────────────────────────────────

export type DesignFonts = {
  heading: string;
  body: string;
};

export type DesignColors = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
};

export const designs = pgTable("designs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  pageId: uuid("page_id").references(() => pages.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  html: text("html").notNull(),
  thumbnail: text("thumbnail"),
  fonts: jsonb("fonts").$type<DesignFonts>(),
  colors: jsonb("colors").$type<DesignColors>(),
  isStandalone: boolean("is_standalone").notNull().default(false),
  isStyleGuide: boolean("is_style_guide").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const designsRelations = relations(designs, ({ one, many }) => ({
  user: one(users, {
    fields: [designs.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [designs.projectId],
    references: [projects.id],
  }),
  page: one(pages, {
    fields: [designs.pageId],
    references: [pages.id],
  }),
  versions: many(designVersions),
}));

// ─── Design Versions ────────────────────────────────────────────────────────

export const designVersions = pgTable("design_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  html: text("html").notNull(),
  prompt: text("prompt"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const designVersionsRelations = relations(
  designVersions,
  ({ one }) => ({
    design: one(designs, {
      fields: [designVersions.designId],
      references: [designs.id],
    }),
  }),
);

// ─── Saved Components ───────────────────────────────────────────────────────

export const savedComponents = pgTable("saved_components", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  html: text("html").notNull(),
  thumbnail: text("thumbnail"),
  category: text("category"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const savedComponentsRelations = relations(
  savedComponents,
  ({ one }) => ({
    user: one(users, {
      fields: [savedComponents.userId],
      references: [users.id],
    }),
  }),
);

// ─── Build Configs ──────────────────────────────────────────────────────────

export const buildConfigs = pgTable("build_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  framework: text("framework", {
    enum: ["nextjs", "vite_react", "html"],
  })
    .notNull()
    .default("nextjs"),
  styling: text("styling", {
    enum: ["tailwind", "css", "scss"],
  })
    .notNull()
    .default("tailwind"),
  includeTypeScript: boolean("include_typescript").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const buildConfigsRelations = relations(buildConfigs, ({ one }) => ({
  project: one(projects, {
    fields: [buildConfigs.projectId],
    references: [projects.id],
  }),
}));

// ─── Build Outputs ──────────────────────────────────────────────────────────

export type BuildFile = {
  path: string;
  content: string;
};

export const buildOutputs = pgTable("build_outputs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  buildConfigId: uuid("build_config_id")
    .notNull()
    .references(() => buildConfigs.id),
  status: text("status", {
    enum: ["pending", "generating", "complete", "failed"],
  })
    .notNull()
    .default("pending"),
  files: jsonb("files").$type<BuildFile[]>(),
  zipUrl: text("zip_url"),
  error: text("error"),
  previewUrl: text("preview_url"),
  previewToken: text("preview_token"),
  previewDeploymentId: text("preview_deployment_id"),
  previewVercelProjectId: text("preview_vercel_project_id"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const buildOutputsRelations = relations(buildOutputs, ({ one }) => ({
  project: one(projects, {
    fields: [buildOutputs.projectId],
    references: [projects.id],
  }),
  buildConfig: one(buildConfigs, {
    fields: [buildOutputs.buildConfigId],
    references: [buildConfigs.id],
  }),
}));

// ─── Published Sites ─────────────────────────────────────────────────────────

export const publishedSites = pgTable("published_sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: "cascade" }),
  buildOutputId: uuid("build_output_id")
    .notNull()
    .references(() => buildOutputs.id),
  slug: text("slug").notNull().unique(),
  vercelProjectId: text("vercel_project_id").notNull(),
  vercelDeploymentId: text("vercel_deployment_id").notNull(),
  url: text("url").notNull(),
  status: text("status", {
    enum: ["deploying", "ready", "failed", "deleted"],
  })
    .notNull()
    .default("deploying"),
  publishedAt: timestamp("published_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const publishedSitesRelations = relations(
  publishedSites,
  ({ one }) => ({
    project: one(projects, {
      fields: [publishedSites.projectId],
      references: [projects.id],
    }),
    buildOutput: one(buildOutputs, {
      fields: [publishedSites.buildOutputId],
      references: [buildOutputs.id],
    }),
  }),
);

// ─── Chat Conversations ────────────────────────────────────────────────────

export type ChatMessageRecord = {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  actions?: { tool: string; success: boolean; data?: Record<string, unknown> }[];
};

export const chatConversations = pgTable("chat_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  messages: jsonb("messages")
    .$type<ChatMessageRecord[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const chatConversationsRelations = relations(
  chatConversations,
  ({ one }) => ({
    user: one(users, {
      fields: [chatConversations.userId],
      references: [users.id],
    }),
    project: one(projects, {
      fields: [chatConversations.projectId],
      references: [projects.id],
    }),
  }),
);
