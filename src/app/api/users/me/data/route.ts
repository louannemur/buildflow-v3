import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, designs, savedComponents } from "@/lib/db/schema";

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all user data (cascade handles related records like features, flows, pages, build outputs)
    await Promise.all([
      db.delete(projects).where(eq(projects.userId, session.user.id)),
      db.delete(designs).where(eq(designs.userId, session.user.id)),
      db.delete(savedComponents).where(eq(savedComponents.userId, session.user.id)),
    ]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
