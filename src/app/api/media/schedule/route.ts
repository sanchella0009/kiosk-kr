import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getMediaTypeFromMime, saveUpload } from "@/lib/media";
import { broadcastRefresh } from "@/lib/broadcast";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const dateFor = String(formData.get("dateFor") ?? "");
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0 || !dateFor) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "only_images" }, { status: 400 });
  }

  const url = await saveUpload(file);
  const type = getMediaTypeFromMime(file.type);

  await prisma.media.create({
    data: {
      url,
      type,
      category: "SCHEDULE",
      dateFor: new Date(dateFor),
    },
  });

  await broadcastRefresh();
  return NextResponse.json({ ok: true });
}
