import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

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
  revalidatePath("/adm/shifts");
}

export default async function ShiftsAdminPage() {
  const shifts = await prisma.shift.findMany({
    orderBy: [{ startDate: "desc" }],
  });

  return (
    <div className="list">
      <div className="admin-card">
        <h1>Смены</h1>
        <form action={createShift} className="review-form">
          <input className="input" name="title" placeholder="Название (необязательно)" />
          <input className="input" type="date" name="startDate" />
          <input className="input" type="date" name="endDate" />
          <button className="btn-primary" type="submit">Создать смену</button>
        </form>
      </div>
      <div className="admin-card">
        <h2>Список</h2>
        <div className="list" style={{ marginTop: 12 }}>
          {shifts.length === 0 && <div>Пока нет смен.</div>}
          {shifts.map((shift) => (
            <div key={shift.id} className="pill">
              <div style={{ flex: 1 }}>
                {shift.title ? `${shift.title} · ` : ""}
                {shift.startDate.toLocaleDateString("ru-RU")} –
                {shift.endDate.toLocaleDateString("ru-RU")}
              </div>
              <form action={deleteShift}>
                <input type="hidden" name="id" value={shift.id} />
                <button className="btn-ghost" type="submit">Удалить</button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
