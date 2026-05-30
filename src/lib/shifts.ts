import { prisma } from "./db";

/**
 * Returns the shift that is active on the given date,
 * or falls back to the latest created shift if no shift is currently active.
 *
 * @param now Reference date (defaults to current server time)
 */
export async function getActiveOrLatestShift(now = new Date()) {
  let activeShift = await prisma.shift.findFirst({
    where: {
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { startDate: "desc" },
  });

  if (!activeShift) {
    activeShift = await prisma.shift.findFirst({
      orderBy: { startDate: "desc" },
    });
  }

  return activeShift;
}
