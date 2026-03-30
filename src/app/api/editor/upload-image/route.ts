import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { saveUpload } from "@/lib/media";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "only_images" }, { status: 400 });
  }

  const url = await saveUpload(file);
  return NextResponse.json({ url });
}
