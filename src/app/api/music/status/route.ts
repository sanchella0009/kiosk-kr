import { NextResponse } from "next/server";
import { getMusicSetting } from "@/lib/music-settings";

export async function GET() {
  const settings = await getMusicSetting();
  return NextResponse.json({
    enabled: settings.isEnabled,
    message: settings.disabledMessage ?? "",
  });
}
