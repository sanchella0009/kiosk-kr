import { prisma } from "@/lib/db";
import { getTodayRange } from "@/lib/date";
import { runMediaCleanup } from "@/lib/cleanup";
import { KioskClient } from "@/components/KioskClient";

export default async function KioskPage() {
  const { start, end } = getTodayRange();
  const end14 = new Date(start);
  end14.setDate(end14.getDate() + 13);
  end14.setHours(23, 59, 59, 999);

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
  ]);

  return (
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
        serverTime: new Date().toISOString(),
      }}
    />
  );
}
