import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { type, target, kioskId } = await request.json();
    
    if (!type || !target || !kioskId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || null;

    await prisma.kioskAnalytics.create({
      data: {
        type,
        target,
        kioskId,
        ip,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Analytics tracking error:", error);
    return NextResponse.json({ error: "Failed to record event" }, { status: 500 });
  }
}
