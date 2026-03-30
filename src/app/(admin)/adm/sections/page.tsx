import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { broadcastRefresh } from "@/lib/broadcast";
import { SectionForm } from "@/components/admin/SectionForm";

async function toggleSection(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";
  if (!id) return;
  await prisma.section.update({
    where: { id },
    data: { isActive: !isActive },
  });
  await broadcastRefresh();
  revalidatePath("/adm/sections");
  revalidatePath("/");
}

async function deleteSection(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.section.delete({ where: { id } });
  await broadcastRefresh();
  revalidatePath("/adm/sections");
  revalidatePath("/");
}

export default async function SectionsAdminPage() {
  const items = await prisma.section.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="list">
      <div className="admin-card">
        <h1>Разделы</h1>
        <SectionForm />
      </div>
      <div className="admin-card">
        <h2>Список</h2>
        <div className="list" style={{ marginTop: 12 }}>
          {items.length === 0 && <div>Пока нет разделов.</div>}
          {items.map((item) => (
            <div key={item.id} className="card" style={{ padding: 14 }}>
              <SectionForm
                initial={{
                  id: item.id,
                  title: item.title,
                  slug: item.slug,
                  content: item.content ?? "",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <form action={toggleSection}>
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
                <form action={deleteSection}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn-ghost" type="submit">
                    Удалить
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
