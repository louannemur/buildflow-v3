import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, DEFAULT_PREFERENCES } from "@/lib/db/schema";
import { updatePreferencesSchema } from "@/lib/validators/preferences";

/* ─── GET: Fetch current user preferences ────────────────────────────────── */

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { preferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      preferences: { ...DEFAULT_PREFERENCES, ...user.preferences },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

/* ─── PATCH: Update user preferences (partial merge) ─────────────────────── */

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updatePreferencesSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    // Read current preferences
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { preferences: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const merged = {
      ...DEFAULT_PREFERENCES,
      ...user.preferences,
      ...parsed.data,
    };

    const [updated] = await db
      .update(users)
      .set({ preferences: merged })
      .where(eq(users.id, session.user.id))
      .returning({ preferences: users.preferences });

    return NextResponse.json({ preferences: updated.preferences });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
