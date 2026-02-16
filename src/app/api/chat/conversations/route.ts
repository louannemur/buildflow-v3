import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chatConversations } from "@/lib/db/schema";

/* ─── GET: List conversations ──────────────────────────────────────────────── */

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conversations = await db.query.chatConversations.findMany({
      where: eq(chatConversations.userId, session.user.id),
      orderBy: [desc(chatConversations.updatedAt)],
      columns: { id: true, title: true, projectId: true, updatedAt: true },
      limit: 50,
    });

    return NextResponse.json(conversations);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}

/* ─── POST: Create conversation ────────────────────────────────────────────── */

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { title, projectId, messages } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    const [conversation] = await db
      .insert(chatConversations)
      .values({
        userId: session.user.id,
        projectId: projectId ?? null,
        title,
        messages: messages ?? [],
      })
      .returning();

    return NextResponse.json(conversation, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}
