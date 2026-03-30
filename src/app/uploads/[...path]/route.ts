import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { getUploadPathCandidates, normalizeUploadRelativePath } from "@/lib/media";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
};

const getContentType = (filePath: string) =>
  CONTENT_TYPES[path.extname(filePath).toLowerCase()] ??
  "application/octet-stream";

const parseRange = (rangeHeader: string, fileSize: number) => {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  const [, startRaw, endRaw] = match;
  if (!startRaw && !endRaw) return null;

  let start = startRaw ? Number(startRaw) : 0;
  let end = endRaw ? Number(endRaw) : fileSize - 1;

  if (!startRaw && endRaw) {
    const suffixLength = Number(endRaw);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < 0 || start > end || start >= fileSize) return null;

  return {
    start,
    end: Math.min(end, fileSize - 1),
  };
};

const getPathFromRequest = async (
  request: Request,
  context?: { params: Promise<{ path: string[] }> }
) => {
  if (context?.params) {
    const params = await context.params;
    const joined = params.path?.join("/") ?? "";
    const normalized = normalizeUploadRelativePath(joined);
    if (normalized) return normalized;
  }

  try {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/^\/uploads\/?/, "");
    return normalizeUploadRelativePath(pathname);
  } catch {
    return null;
  }
};

const resolveUploadFile = async (relativePath: string) => {
  for (const candidate of getUploadPathCandidates(relativePath)) {
    try {
      const fileStat = await stat(candidate);
      if (fileStat.isFile()) {
        return { filePath: candidate, fileStat };
      }
    } catch {}
  }
  return null;
};

const buildResponse = async (
  request: Request,
  context: { params: Promise<{ path: string[] }> },
  includeBody: boolean
) => {
  const relativePath = await getPathFromRequest(request, context);
  if (!relativePath) {
    return new Response("Not Found", { status: 404 });
  }

  const resolved = await resolveUploadFile(relativePath);
  if (!resolved) {
    return new Response("Not Found", { status: 404 });
  }

  const { filePath, fileStat } = resolved;
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
    "Content-Type": getContentType(filePath),
    ETag: `"${fileStat.size}-${fileStat.mtimeMs}"`,
    "Last-Modified": fileStat.mtime.toUTCString(),
  });

  const rangeHeader = request.headers.get("range");
  if (rangeHeader) {
    const range = parseRange(rangeHeader, fileStat.size);
    if (!range) {
      headers.set("Content-Range", `bytes */${fileStat.size}`);
      return new Response(null, { status: 416, headers });
    }

    const { start, end } = range;
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Content-Range", `bytes ${start}-${end}/${fileStat.size}`);

    if (!includeBody) {
      return new Response(null, { status: 206, headers });
    }

    const stream = Readable.toWeb(
      createReadStream(filePath, { start, end })
    ) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(fileStat.size));

  if (!includeBody) {
    return new Response(null, { status: 200, headers });
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
  return new Response(stream, { status: 200, headers });
};

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return buildResponse(request, context, true);
}

export async function HEAD(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  return buildResponse(request, context, false);
}
