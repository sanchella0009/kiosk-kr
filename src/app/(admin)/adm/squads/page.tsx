import { prisma } from "@/lib/db";
import { getActiveOrLatestShift } from "@/lib/shifts";
import { SquadsAdmin } from "@/components/admin/SquadsAdmin";
import { getCampLogoAction } from "@/app/actions/squads";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SquadsAdminPage({
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

  // Fetch squads with children and their best days
  const squads = await prisma.squad.findMany({
    where: { shiftId: selectedShiftId },
    include: {
      children: {
        include: {
          bestDays: true,
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const logoUrl = await getCampLogoAction();

  return (
    <div className="list" style={{ gap: 20 }}>
      <div className="admin-card">
        <h1>👥 Управление отрядами и детьми</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: 4 }}>
          Добавляйте отряды, загружайте их фотографии, управляйте списком детей (в том числе массовым импортом), отмечайте выбывших и выбирайте лучшего ребенка дня.
        </p>
      </div>

      <SquadsAdmin
        shift={shift}
        shifts={shifts}
        initialSquads={squads}
        initialLogoUrl={logoUrl}
      />
    </div>
  );
}
