import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { broadcastRefresh } from "@/lib/broadcast";
import { deleteUploadIfLocal } from "@/lib/media";

const getIdFromRequest = async (request: Request, context?: { params: Promise<{ id: string }> }) => {
  if (context?.params) {
    const p = await context.params;
    if (p.id) return p.id;
  }
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1];
  } catch {
    return undefined;
  }
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = await getIdFromRequest(request, context);
  if (!id) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  const body = (await request.json()) as { isActive?: boolean };
  await prisma.media.update({
    where: { id },
    data: { isActive: Boolean(body.isActive) },
  });
  await broadcastRefresh();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = await getIdFromRequest(request, context);
  if (!id) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  try {
    const item = await prisma.media.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await prisma.media.delete({ where: { id } });
    await deleteUploadIfLocal(item.url);
    await broadcastRefresh();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: "delete_failed", message }, { status: 500 });
  }
}
