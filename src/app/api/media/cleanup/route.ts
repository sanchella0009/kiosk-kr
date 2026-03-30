import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { readdir, unlink } from "fs/promises";
import path from "path";
import { getAllUploadDirs, normalizeUploadRelativePath } from "@/lib/media";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const items = await prisma.media.findMany({ select: { url: true } });
  const used = new Set(
    items
      .map((item) => item.url)
      .filter((url) => url.startsWith("/uploads/"))
      .map((url) => normalizeUploadRelativePath(url.replace("/uploads/", "")))
      .filter((url): url is string => Boolean(url))
  );

  let deleted = 0;
  let total = 0;

  for (const dir of getAllUploadDirs()) {
    let files: string[] = [];
    try {
      files = (await readdir(dir)).filter((file) => !file.startsWith("."));
    } catch {
      continue;
    }

    total += files.length;
    for (const file of files) {
      if (!used.has(file)) {
        try {
          await unlink(path.join(dir, file));
          deleted += 1;
        } catch {
          // ignore
        }
      }
    }
  }

  return NextResponse.json({ ok: true, deleted, total });
}
