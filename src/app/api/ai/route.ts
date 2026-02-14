import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkUsage, incrementUsage } from "@/lib/usage";
import type { Plan } from "@/lib/plan-limits";
import {
  generateDesign,
  editDesign,
  modifyElement,
  addSection,
} from "@/lib/ai/design";

export async function POST(req: Request) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const plan = (session.user.plan ?? "free") as Plan;

  const body = await req.json();
  if (!body || typeof body.action !== "string") {
    return NextResponse.json(
      { error: "Invalid request: action required" },
      { status: 400 }
    );
  }

  const { action, ...data } = body;

  // 2. Usage check
  const usageCheck = await checkUsage(userId, plan, "design_generation");
  if (!usageCheck.allowed) {
    return NextResponse.json(
      {
        error: "rate_limited",
        message: usageCheck.message,
        code: "LIMIT_REACHED",
      },
      { status: 429 }
    );
  }

  try {
    let result: string;

    switch (action) {
      case "generate-design":
        result = await generateDesign(data);
        break;
      case "edit-design":
        result = await editDesign(data);
        break;
      case "modify-element":
        result = await modifyElement(data);
        break;
      case "add-section":
        result = await addSection(data);
        break;
      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }

    // 3. Increment usage
    await incrementUsage(userId, "designGenerations");

    return NextResponse.json({ code: result });
  } catch (error) {
    console.error("AI design error:", error);
    return NextResponse.json(
      { error: "AI generation failed. Please try again." },
      { status: 500 }
    );
  }
}
