import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? "MAIN";
  if (category !== "MAIN") {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const items = await prisma.media.findMany({
    where: { category: "MAIN" },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({ items });
}
