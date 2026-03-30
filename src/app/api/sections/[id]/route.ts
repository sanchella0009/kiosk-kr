import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { broadcastRefresh } from "@/lib/broadcast";

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

  try {
    await prisma.section.update({
      where: { id },
      data: {
        title,
        slug,
        content,
      },
    });

    await broadcastRefresh();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json({ error: "update_failed", message }, { status: 500 });
  }
}
