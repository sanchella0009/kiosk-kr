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

  const [media, scheduleImages, menuImages, sections, reviews, squads, events, campLogoSetting] =
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
      activeShift
        ? prisma.squad.findMany({
            where: { shiftId: activeShift.id },
            include: {
              children: {
                include: {
                  bestDays: true,
                },
                orderBy: { name: "asc" },
              },
              photos: true,
            },
            orderBy: { sortOrder: "asc" },
          })
        : Promise.resolve([]),
      activeShift
        ? prisma.event.findMany({
            where: {
              date: {
                gte: rangeStart,
                lte: rangeEnd,
              },
            },
            include: {
              places: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          })
        : Promise.resolve([]),
      prisma.campSetting.findUnique({
        where: { key: "camp_logo" },
      }),
    ]);

  const squadOfDays = activeShift && squads.length > 0
    ? await prisma.squadOfDay.findMany({
        where: {
          squadId: {
            in: squads.map((s) => s.id),
          },
        },
      })
    : [];

  const penaltiesRewards = activeShift && squads.length > 0
    ? await prisma.squadPenaltyReward.findMany({
        where: {
          squadId: {
            in: squads.map((s) => s.id),
          },
        },
        orderBy: {
          date: "asc",
        },
      })
    : [];

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
    squads: squads.map((s) => ({
      id: s.id,
      name: s.name,
      photoUrl: s.photoUrl,
      photos: s.photos.map((p) => p.url),
      children: s.children.map((c) => ({
        id: c.id,
        name: c.name,
        isLeft: c.isLeft,
        isCommander: c.isCommander,
        bestDays: c.bestDays.map((b) => ({
          date: b.date.toISOString(),
        })),
      })),
    })),
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      places: e.places.map((p) => ({
        squadId: p.squadId,
        place: p.place,
      })),
    })),
    squadOfDays: squadOfDays.map((sd) => ({
      squadId: sd.squadId,
      date: sd.date.toISOString(),
      stars: sd.stars,
    })),
    penaltiesRewards: penaltiesRewards.map((pr) => ({
      id: pr.id,
      squadId: pr.squadId,
      type: pr.type,
      points: pr.points,
      reason: pr.reason,
      date: pr.date.toISOString(),
    })),
    campLogo: campLogoSetting?.value || null,
    activeShift: activeShift
      ? {
          id: activeShift.id,
          title: activeShift.title,
          startDate: activeShift.startDate.toISOString(),
          endDate: activeShift.endDate.toISOString(),
        }
      : null,
    serverTime: new Date().toISOString(),
  });
}
