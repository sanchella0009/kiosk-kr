import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { broadcastRefresh } from "@/lib/broadcast";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    slug?: string;
    content?: string;
  };

  const title = (body.title ?? "").trim();
  const slug = (body.slug ?? "").trim();
  const content = body.content ?? "";

  if (!title || !slug) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  await prisma.section.create({
    data: {
      title,
      slug,
      content,
    },
  });

  await broadcastRefresh();
  return NextResponse.json({ ok: true });
}
