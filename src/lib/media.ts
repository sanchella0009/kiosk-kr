import path from "path";
import { mkdir, writeFile, unlink } from "fs/promises";
import crypto from "crypto";

export type MediaKind = "PHOTO" | "VIDEO";
const UPLOADS_URL_PREFIX = "/uploads/";

export const getMediaTypeFromMime = (mime: string | null): MediaKind => {
  if (!mime) return "PHOTO";
  return mime.startsWith("video/") ? "VIDEO" : "PHOTO";
};

export const getMediaTypeFromUrl = (url: string): MediaKind => {
  const lower = url.toLowerCase();
  if (lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")) {
    return "VIDEO";
  }
  return "PHOTO";
};

export const saveUpload = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const ext = path.extname(file.name) || ".bin";
  const fileName = `${crypto.randomUUID()}${ext}`;
  return saveBuffer(buffer, fileName);
};

export const getUploadDir = () => path.join(process.cwd(), "uploads");

export const getLegacyUploadDir = () =>
  path.join(process.cwd(), "public", "uploads");

export const getAllUploadDirs = () => [getUploadDir(), getLegacyUploadDir()];

export const normalizeUploadRelativePath = (relativePath: string) => {
  const normalized = path.posix.normalize(relativePath).replace(/^\/+/, "");
  if (
    !normalized ||
    normalized === "." ||
    normalized.startsWith("..") ||
    path.posix.isAbsolute(normalized)
  ) {
    return null;
  }
  return normalized;
};

export const getUploadRelativePathFromUrl = (url: string) => {
  if (!url.startsWith(UPLOADS_URL_PREFIX)) return null;
  return normalizeUploadRelativePath(url.slice(UPLOADS_URL_PREFIX.length));
};

export const getUploadPathCandidates = (relativePath: string) => {
  const normalized = normalizeUploadRelativePath(relativePath);
  if (!normalized) return [];
  return getAllUploadDirs().map((dir) => path.join(dir, normalized));
};

export const saveBuffer = async (buffer: Buffer, fileName: string) => {
  const uploadDir = getUploadDir();
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, fileName);
  await writeFile(filePath, buffer);
  return `${UPLOADS_URL_PREFIX}${fileName}`;
};

export const deleteUploadIfLocal = async (url: string) => {
  const relativePath = getUploadRelativePathFromUrl(url);
  if (!relativePath) return;
  await Promise.all(
    getUploadPathCandidates(relativePath).map(async (filePath) => {
      try {
        await unlink(filePath);
      } catch {}
    })
  );
};
