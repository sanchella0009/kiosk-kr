import { NextResponse } from "next/server";
import { getMusicSetting } from "@/lib/music-settings";

export async function POST(request: Request) {
  const body = await request.json();
  const artistId =
    typeof body.artistId === "string" ? body.artistId.trim() : "";
  if (!artistId) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const limit = Number(body.limit ?? 12);
  const url = process.env.MUSIC_SERVICE_URL ?? "http://kiosk-music:3010";

  const settings = await getMusicSetting();
  if (!settings.isEnabled) {
    return NextResponse.json(
      { error: "disabled", message: settings.disabledMessage },
      { status: 403 }
    );
  }

  try {
    const res = await fetch(`${url}/artist-tracks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artist_id: artistId, limit }),
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "search_failed" }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 502 });
  }
}
