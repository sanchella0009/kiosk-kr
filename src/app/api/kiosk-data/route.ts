import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTodayRange } from "@/lib/date";
import { runMediaCleanup } from "@/lib/cleanup";
import { getActiveOrLatestShift } from "@/lib/shifts";

export async function GET() {
  const now = new Date();
  const { start } = getTodayRange();
  const end14 = new Date(start);
  end14.setDate(end14.getDate() + 13);
  end14.setHours(23, 59, 59, 999);

  const activeShift = await getActiveOrLatestShift(now);

  const rangeStart = activeShift
    ? new Date(
        activeShift.startDate.getFullYear(),
        activeShift.startDate.getMonth(),
        activeShift.startDate.getDate()
      )
    : start;
  const rangeEnd = activeShift
    ? new Date(
        activeShift.endDate.getFullYear(),
        activeShift.endDate.getMonth(),
        activeShift.endDate.getDate(),
        23,
        59,
        59,
        999
      )
    : end14;

  await runMediaCleanup();

  const [media, scheduleImages, menuImages, sections, reviews] =
    await Promise.all([
      prisma.media.findMany({
        where: { isActive: true, category: "MAIN" },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      }),
      prisma.media.findMany({
        where: {
          isActive: true,
          category: "SCHEDULE",
          dateFor: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: [{ dateFor: "asc" }, { createdAt: "asc" }],
      }),
      prisma.media.findMany({
        where: {
          isActive: true,
          category: "MENU",
          dateFor: { gte: rangeStart, lte: rangeEnd },
        },
        orderBy: [{ dateFor: "asc" }, { createdAt: "asc" }],
      }),
      prisma.section.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      }),
      prisma.review.findMany({
        where: { status: "APPROVED" },
        orderBy: [{ createdAt: "desc" }],
        take: 20,
      }),
    ]);

  return NextResponse.json({
    media,
    scheduleImages: scheduleImages.map((item) => ({
      id: item.id,
      url: item.url,
      dateFor: item.dateFor?.toISOString() ?? "",
    })),
    menuImages: menuImages.map((item) => ({
      id: item.id,
      url: item.url,
      dateFor: item.dateFor?.toISOString() ?? "",
    })),
    sections,
    reviews,
    activeShiftCounselors: activeShift?.counselors || null,
    serverTime: new Date().toISOString(),
  });
}
