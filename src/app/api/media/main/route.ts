import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import {
  getMediaTypeFromMime,
  getMediaTypeFromUrl,
  saveUpload,
} from "@/lib/media";
import { broadcastRefresh } from "@/lib/broadcast";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const urlInput = String(formData.get("url") ?? "").trim();
  const file = formData.get("file");

  let url = urlInput;
  let type = "PHOTO";

  if (file instanceof File && file.size > 0) {
    url = await saveUpload(file);
    type = getMediaTypeFromMime(file.type);
  } else if (urlInput) {
    type = getMediaTypeFromUrl(urlInput);
  }

  if (!url) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  await prisma.media.create({
    data: {
      url,
      type: type === "VIDEO" ? "VIDEO" : "PHOTO",
      category: "MAIN",
    },
  });

  await broadcastRefresh();
  return NextResponse.json({ ok: true });
}
