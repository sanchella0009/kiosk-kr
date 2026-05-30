import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { getSessionUser } from "@/lib/auth";
import { broadcastRefresh } from "@/lib/broadcast";
import { CounselorsForm } from "@/components/admin/CounselorsForm";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function createShift(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  if (!startDate || !endDate) return;

  await prisma.shift.create({
    data: {
      title: title || null,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    },
  });

  revalidatePath("/adm/shifts");
}

async function deleteShift(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.shift.delete({ where: { id } });
  await broadcastRefresh();
  revalidatePath("/adm/shifts");
}

async function saveCounselorsAction(shiftId: string, counselorsJson: string) {
  "use server";
  const user = await getSessionUser();
  if (!user) return { success: false, error: "Не авторизован" };

  try {
    const parsed = JSON.parse(counselorsJson);
    if (!Array.isArray(parsed)) throw new Error();
  } catch {
    return { success: false, error: "Некорректный формат данных" };
  }

  await prisma.shift.update({
    where: { id: shiftId },
    data: { counselors: counselorsJson },
  });

  await broadcastRefresh();
  return { success: true };
}

export default async function ShiftsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ shiftId?: string }>;
}) {
  const params = await searchParams;
  const shiftId = params.shiftId;

  if (shiftId) {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      return (
        <div className="admin-card" style={{ padding: 24, textAlign: "center" }}>
          <h2>Смена не найдена</h2>
          <p style={{ color: "var(--ink-muted)", marginTop: 8 }}>
            Возможно, эта смена была удалена.
          </p>
          <Link href="/adm/shifts" className="btn-primary" style={{ display: "inline-block", marginTop: 16 }}>
            ← Назад к сменам
          </Link>
        </div>
      );
    }

    return (
      <div className="list" style={{ gap: 20 }}>
        {/* Title Header Card */}
        <div className="admin-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>
              👥 Сотрудники смены: <span style={{ color: "var(--accent)" }}>{shift.title || "Смена без названия"}</span>
            </h1>
            <p style={{ color: "var(--ink-muted)", marginTop: 6 }}>
              📅 Период проведения: <strong>{shift.startDate.toLocaleDateString("ru-RU")}</strong> – <strong>{shift.endDate.toLocaleDateString("ru-RU")}</strong>
            </p>
          </div>
          <Link href="/adm/shifts" className="btn-ghost" style={{ padding: "10px 20px" }}>
            ← Назад к списку смен
          </Link>
        </div>

        {/* Counselors editor */}
        <div className="admin-card">
          <CounselorsForm
            shift={shift}
            saveCounselorsAction={saveCounselorsAction}
          />
        </div>
      </div>
    );
  }

  // Otherwise, display list of shifts and creation form
  const shifts = await prisma.shift.findMany({
    orderBy: [{ startDate: "desc" }],
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="list" style={{ gap: 20 }}>
      {/* Title Header Card */}
      <div className="admin-card">
        <h1>Смены и сотрудники</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: 4 }}>
          Управление сменами детского лагеря и закрепленным персоналом (вожатые, администрация, кружки).
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.9fr", gap: 24, alignItems: "start" }}>
        {/* Create Shift Form */}
        <div className="admin-card">
          <h2>Создать смену</h2>
          <form action={createShift} className="review-form" style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 700 }}>Название смены:</label>
              <input 
                className="input" 
                name="title" 
                placeholder="Например: 1-я Летняя смена" 
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 700 }}>Дата начала:</label>
              <input className="input" type="date" name="startDate" required />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 700 }}>Дата окончания:</label>
              <input className="input" type="date" name="endDate" required />
            </div>
            <button className="btn-primary" type="submit" style={{ marginTop: 8 }}>
              Создать смену
            </button>
          </form>
        </div>

        {/* Shifts List */}
        <div className="admin-card">
          <h2>Список смен ({shifts.length})</h2>
          <div className="list" style={{ marginTop: 16, gap: 12 }}>
            {shifts.length === 0 ? (
              <div style={{ color: "var(--ink-muted)", fontStyle: "italic", padding: 8 }}>
                Смены не созданы.
              </div>
            ) : (
              shifts.map((shift) => {
                const start = new Date(shift.startDate);
                start.setHours(0, 0, 0, 0);
                const end = new Date(shift.endDate);
                end.setHours(23, 59, 59, 999);
                const isActive = today >= start && today <= end;

                return (
                  <div 
                    key={shift.id} 
                    className="card" 
                    style={{ 
                      padding: 16, 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      gap: 16,
                      border: isActive ? "2px solid #cfe8d0" : "1px solid #f3d6a0",
                      background: isActive ? "#f8fff8" : "#fff"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div 
                        style={{ 
                          fontSize: 24, 
                          width: 48, 
                          height: 48, 
                          borderRadius: 12, 
                          background: isActive ? "#cfe8d0" : "#fff6e5", 
                          display: "grid", 
                          placeItems: "center" 
                        }}
                      >
                        🔄
                      </div>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 16 }}>
                            {shift.title || "Смена без названия"}
                          </span>
                          {isActive && (
                            <span 
                              style={{ 
                                background: "#cfe8d0", 
                                color: "#1f5f2c", 
                                fontSize: 12, 
                                fontWeight: 700, 
                                padding: "2px 8px", 
                                borderRadius: 6 
                              }}
                            >
                              Текущая смена
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 14, color: "var(--ink-muted)", marginTop: 4 }}>
                          📅 {shift.startDate.toLocaleDateString("ru-RU")} – {shift.endDate.toLocaleDateString("ru-RU")}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Link 
                        href={`/adm/shifts?shiftId=${shift.id}`} 
                        className="btn-ghost"
                        style={{ padding: "8px 14px", fontSize: 13, borderColor: "var(--accent-2)", color: "var(--accent-2)" }}
                      >
                        👥 Сотрудники
                      </Link>
                      <form action={deleteShift}>
                        <input type="hidden" name="id" value={shift.id} />
                        <ConfirmButton 
                          className="btn-ghost" 
                          type="submit" 
                          style={{ borderColor: "#b1462b", color: "#b1462b", padding: "8px 14px", fontSize: 13 }}
                          message="Вы действительно хотите удалить эту смену? Это действие нельзя отменить."
                        >
                          Удалить
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
