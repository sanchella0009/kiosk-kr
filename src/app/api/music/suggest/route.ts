import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendSongSuggestionToTelegram } from "@/lib/telegram";
import { getMusicSetting } from "@/lib/music-settings";

const DUPLICATE_WINDOW_MS = 15_000;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const body = await request.json();
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const trackId = typeof body.trackId === "string" ? body.trackId.trim() : "";
  const artist = typeof body.artist === "string" ? body.artist.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const year = Number.isFinite(Number(body.year)) ? Number(body.year) : null;
  const yandexUrl =
    typeof body.yandexUrl === "string" ? body.yandexUrl.trim() : "";
  const coverUrl =
    typeof body.coverUrl === "string" ? body.coverUrl.trim() : null;

  if (!query || !trackId || !artist || !title || !yandexUrl) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const settings = await getMusicSetting();
  if (!settings.isEnabled) {
    return NextResponse.json(
      { error: "disabled", message: settings.disabledMessage },
      { status: 403 }
    );
  }

  const duplicateThreshold = new Date(Date.now() - DUPLICATE_WINDOW_MS);
  const existing = await prisma.songSuggestion.findFirst({
    where: {
      query,
      trackId,
      createdAt: { gte: duplicateThreshold },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    console.info(
      `[music-suggest] duplicate suppressed track=${trackId} query="${query}" age_ms=${Date.now() - startedAt}`
    );
    return NextResponse.json({ ok: true, duplicate: true, id: existing.id });
  }

  const suggestion = await prisma.songSuggestion.create({
    data: {
      query,
      trackId,
      artist,
      title,
      year,
      yandexUrl,
      coverUrl,
    },
  });

  console.info(
    `[music-suggest] saved id=${suggestion.id} track=${trackId} db_ms=${Date.now() - startedAt}`
  );

  void (async () => {
    const telegramStartedAt = Date.now();
    await sendSongSuggestionToTelegram({
      id: suggestion.id,
      artist: suggestion.artist,
      title: suggestion.title,
      year: suggestion.year,
      yandexUrl: suggestion.yandexUrl,
    });
    console.info(
      `[music-suggest] telegram_sent id=${suggestion.id} telegram_ms=${Date.now() - telegramStartedAt}`
    );
  })().catch((error) => {
    console.error("Failed to send song suggestion to Telegram", error);
  });

  return NextResponse.json({ ok: true });
}
