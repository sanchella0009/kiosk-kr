import { prisma } from "@/lib/db";
import { getTodayRange } from "@/lib/date";
import { runMediaCleanup } from "@/lib/cleanup";
import { KioskClient } from "@/components/KioskClient";
import { KioskInteractionMode } from "@/components/KioskInteractionMode";
import { getActiveOrLatestShift } from "@/lib/shifts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function KioskPage() {
  const { start } = getTodayRange();
  const end14 = new Date(start);
  end14.setDate(end14.getDate() + 13);
  end14.setHours(23, 59, 59, 999);

  await runMediaCleanup();

  const activeShift = await getActiveOrLatestShift();

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
          dateFor: { gte: start, lte: end14 },
        },
        orderBy: [{ dateFor: "asc" }, { createdAt: "asc" }],
      }),
      prisma.media.findMany({
        where: {
          isActive: true,
          category: "MENU",
          dateFor: { gte: start, lte: end14 },
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
            },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      activeShift
        ? prisma.event.findMany({
            where: {
              date: {
                gte: activeShift.startDate,
                lte: activeShift.endDate,
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

  return (
    <>
      <KioskInteractionMode />
      <KioskClient
        initialData={{
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
            children: s.children.map((c) => ({
              id: c.id,
              name: c.name,
              isLeft: c.isLeft,
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
        }}
      />
    </>
  );
}
