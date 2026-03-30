import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { MediaUploadForm } from "@/components/admin/MediaUploadForm";
import { broadcastRefresh } from "@/lib/broadcast";
import { deleteUploadIfLocal } from "@/lib/media";

async function toggleSchedule(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";
  if (!id) return;
  await prisma.media.update({
    where: { id },
    data: { isActive: !isActive },
  });
  await broadcastRefresh();
  revalidatePath("/adm/schedule");
  revalidatePath("/");
}

async function deleteSchedule(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const item = await prisma.media.findUnique({ where: { id } });
  if (!item) return;
  await prisma.media.delete({ where: { id } });
  await deleteUploadIfLocal(item.url);
  await broadcastRefresh();
  revalidatePath("/adm/schedule");
  revalidatePath("/");
}

export default async function ScheduleAdminPage() {
  const items = await prisma.media.findMany({
    where: { category: "SCHEDULE" },
    orderBy: [{ createdAt: "desc" }],
  });

  return (
    <div className="list">
      <div className="admin-card">
        <h1>Расписание (фото)</h1>
        <MediaUploadForm endpoint="/api/media/schedule" mode="schedule" />
      </div>
      <div className="admin-card">
        <h2>Список</h2>
        <div className="list" style={{ marginTop: 12 }}>
          {items.length === 0 && <div>Пока нет расписания.</div>}
          {items.map((item) => (
            <div key={item.id} className="pill">
              <div style={{ flex: 1 }}>
                🖼️ {item.dateFor?.toLocaleDateString("ru-RU") ?? "Без даты"}
              </div>
              <form action={toggleSchedule}>
                <input type="hidden" name="id" value={item.id} />
                <input
                  type="hidden"
                  name="isActive"
                  value={String(item.isActive)}
                />
                <button className="btn-ghost" type="submit">
                  {item.isActive ? "Скрыть" : "Показать"}
                </button>
              </form>
              <form action={deleteSchedule}>
                <input type="hidden" name="id" value={item.id} />
                <button className="btn-ghost" type="submit">
                  Удалить
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
