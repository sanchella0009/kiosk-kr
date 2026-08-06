import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { broadcastRefresh } from "@/lib/broadcast";
import { deleteUploadIfLocal } from "@/lib/media";

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

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = body.ids;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
    }

    const items = await prisma.media.findMany({
      where: { id: { in: ids } },
    });

    await prisma.media.deleteMany({
      where: { id: { in: ids } },
    });

    for (const item of items) {
      await deleteUploadIfLocal(item.url);
    }

    await broadcastRefresh();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: "delete_failed", message }, { status: 500 });
  }
}

