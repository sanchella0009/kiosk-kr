import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getMusicSetting } from "@/lib/music-settings";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const deleteSuggestion = async (formData: FormData) => {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.songSuggestion.delete({ where: { id } });
  revalidatePath("/adm/songs");
};

const updateSettings = async (formData: FormData) => {
  "use server";
  await requireAdmin();
  const isEnabled = formData.get("isEnabled") === "on";
  const message = String(formData.get("disabledMessage") ?? "").trim();
  await prisma.musicSetting.upsert({
    where: { key: "main" },
    update: {
      isEnabled,
      disabledMessage: message || "Предложения временно отключены.",
    },
    create: {
      key: "main",
      isEnabled,
      disabledMessage: message || "Предложения временно отключены.",
    },
  });
  revalidatePath("/adm/songs");
};

export default async function SongsAdminPage() {
  await requireAdmin();
  const settings = await getMusicSetting();
  const items = await prisma.songSuggestion.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="list">
      <div className="admin-card">
        <h1>Заявки на песни</h1>
        <p>Последние предложения для диджея.</p>
      </div>
      <div className="admin-card">
        <h2>Настройки предложки</h2>
        <form action={updateSettings} className="review-form">
          <label style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="checkbox"
              name="isEnabled"
              defaultChecked={settings.isEnabled}
              className="switch-input"
            />
            <span className="switch" />
            Включить предложения
          </label>
          <textarea
            className="textarea"
            name="disabledMessage"
            defaultValue={settings.disabledMessage ?? ""}
            placeholder="Сообщение при отключении"
          />
          <button className="btn-primary" type="submit">
            Сохранить
          </button>
        </form>
      </div>
      {items.length === 0 ? (
        <div>Пока нет заявок.</div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            className="admin-card"
            style={{ padding: 16 }}
          >
            <div style={{ display: "flex", gap: 16 }}>
              {item.coverUrl ? (
                <img
                  src={item.coverUrl}
                  alt=""
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: 12,
                    objectFit: "cover",
                  }}
                />
              ) : null}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>
                  {item.artist} — {item.title}
                  {item.year ? ` (${item.year})` : ""}
                </div>
                <div style={{ color: "var(--ink-muted)", marginTop: 4 }}>
                  Запрос: {item.query}
                </div>
                <a
                  href={item.yandexUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ display: "inline-block", marginTop: 8 }}
                >
                  Открыть в Яндекс Музыке
                </a>
                <form action={deleteSuggestion} style={{ display: "inline-block", marginTop: 8, marginLeft: 8 }}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn-ghost" type="submit">
                    Удалить
                  </button>
                </form>
              </div>
              <div style={{ color: "var(--ink-muted)" }}>
                {item.createdAt.toLocaleString("ru-RU")}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
