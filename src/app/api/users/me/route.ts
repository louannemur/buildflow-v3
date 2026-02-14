import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, subscriptions } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
import { z } from "zod";

/* ─── Validation ─────────────────────────────────────────────────────────── */

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  image: z.string().max(500_000).nullable().optional(), // base64 can be large
});

/* ─── GET: Fetch current user profile ────────────────────────────────────── */

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: {
        id: true,
        name: true,
        email: true,
        image: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

/* ─── PATCH: Update current user profile ─────────────────────────────────── */

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(users)
      .set(parsed.data)
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        emailVerified: users.emailVerified,
      });

    if (!updated) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: updated }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

/* ─── DELETE: Delete account ──────────────────────────────────────────────── */

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cancel Stripe subscription if one exists
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, session.user.id),
      columns: { stripeSubscriptionId: true },
    });

    if (sub?.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      } catch {
        // Subscription may already be canceled — continue with deletion
      }
    }

    // Delete user (cascade handles all related data)
    await db.delete(users).where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
