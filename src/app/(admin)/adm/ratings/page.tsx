import { prisma } from "@/lib/db";
import { getActiveOrLatestShift } from "@/lib/shifts";
import { RatingsAdmin } from "@/components/admin/RatingsAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RatingsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ shiftId?: string }>;
}) {
  const params = await searchParams;
  const shifts = await prisma.shift.findMany({
    orderBy: { startDate: "desc" },
  });

  const activeShift = await getActiveOrLatestShift();
  const selectedShiftId = params.shiftId || activeShift?.id;

  if (!selectedShiftId) {
    return (
      <div className="admin-card" style={{ padding: 24, textAlign: "center" }}>
        <h2>Смены не найдены</h2>
        <p style={{ color: "var(--ink-muted)", marginTop: 8 }}>
          Пожалуйста, сначала создайте хотя бы одну смену в разделе "Смены и вожатые".
        </p>
      </div>
    );
  }

  const shift = await prisma.shift.findUnique({
    where: { id: selectedShiftId },
  });

  if (!shift) {
    return (
      <div className="admin-card" style={{ padding: 24, textAlign: "center" }}>
        <h2>Смена не найдена</h2>
      </div>
    );
  }

  // Fetch squads in this shift
  const squads = await prisma.squad.findMany({
    where: { shiftId: selectedShiftId },
    orderBy: { sortOrder: "asc" },
  });

  // Fetch events that occur during this shift
  const events = await prisma.event.findMany({
    where: {
      date: {
        gte: shift.startDate,
        lte: shift.endDate,
      },
    },
    include: {
      places: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Fetch Squad of the Day records for this shift's squads
  const squadOfDays = await prisma.squadOfDay.findMany({
    where: {
      squadId: {
        in: squads.map((s) => s.id),
      },
    },
  });

  // Fetch penalties and rewards for this shift's squads
  const penaltiesRewards = await prisma.squadPenaltyReward.findMany({
    where: {
      squadId: {
        in: squads.map((s) => s.id),
      },
    },
    orderBy: {
      date: "desc",
    },
  });

  return (
    <div className="list" style={{ gap: 20 }}>
      <div className="admin-card">
        <h1>🏆 Управление рейтингом отрядов</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: 4 }}>
          Создавайте общелагерные мероприятия, распределяйте места среди отрядов, отмечайте отряды дня с присвоением звезд и управляйте системой штрафов/поощрений.
        </p>
      </div>

      <RatingsAdmin
        shift={shift}
        shifts={shifts}
        squads={squads}
        events={events}
        squadOfDays={squadOfDays}
        penaltiesRewards={penaltiesRewards}
      />
    </div>
  );
}

