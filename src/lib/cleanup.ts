import { prisma } from "@/lib/db";
import { deleteUploadIfLocal } from "@/lib/media";

export const runMediaCleanup = async () => {
  const now = new Date();

  const shifts = await prisma.shift.findMany({
    orderBy: [{ startDate: "asc" }],
  });

  const expiredShifts = shifts.filter((shift) => shift.endDate < now);
  if (expiredShifts.length > 0) {
    for (const shift of expiredShifts) {
      const media = await prisma.media.findMany({
        where: {
          category: { in: ["MENU", "SCHEDULE"] },
          dateFor: { gte: shift.startDate, lte: shift.endDate },
        },
      });
      await prisma.media.deleteMany({
        where: {
          category: { in: ["MENU", "SCHEDULE"] },
          dateFor: { gte: shift.startDate, lte: shift.endDate },
        },
      });
      await Promise.all(media.map((item) => deleteUploadIfLocal(item.url)));
    }

    await prisma.shift.deleteMany({
      where: { id: { in: expiredShifts.map((s) => s.id) } },
    });
  }

  const activeShifts = shifts.filter((shift) => shift.endDate >= now);

  const candidates = await prisma.media.findMany({
    where: {
      category: { in: ["MENU", "SCHEDULE"] },
      dateFor: { not: null },
    },
  });

  const toDelete: string[] = [];
  for (const item of candidates) {
    const dateFor = item.dateFor;
    if (!dateFor) continue;
    const inShift = activeShifts.some(
      (shift) => dateFor >= shift.startDate && dateFor <= shift.endDate
    );
    if (inShift) continue;

    const deadline = new Date(dateFor);
    deadline.setDate(deadline.getDate() + 7);
    if (deadline < now) {
      toDelete.push(item.id);
      await deleteUploadIfLocal(item.url);
    }
  }

  if (toDelete.length > 0) {
    await prisma.media.deleteMany({ where: { id: { in: toDelete } } });
  }
};
