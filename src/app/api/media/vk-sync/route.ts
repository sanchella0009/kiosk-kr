import { NextResponse } from "next/server";
import { syncVkMenuAction } from "@/app/actions/vk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await syncVkMenuAction();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || String(error), count: 0 },
      { status: 500 }
    );
  }
}
