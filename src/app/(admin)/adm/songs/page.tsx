import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getMusicSetting } from "@/lib/music-settings";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SongsFilter = "all" | "clean" | "explicit";

const normalizeSongsFilter = (value?: string): SongsFilter => {
  if (value === "clean" || value === "explicit") return value;
  return "all";
};

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

export default async function SongsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const filter = normalizeSongsFilter(params.filter);
  const settings = await getMusicSetting();
  const items = await prisma.songSuggestion.findMany({
    where:
      filter === "all"
        ? {}
        : {
            isExplicit: filter === "explicit",
          },
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
      <div className="admin-card">
        <h2>Фильтр</h2>
        <div className="admin-filters">
          <Link
            href="/adm/songs"
            className={`pill admin-filter-link${filter === "all" ? " active" : ""}`}
          >
            Все
          </Link>
          <Link
            href="/adm/songs?filter=clean"
            className={`pill admin-filter-link${filter === "clean" ? " active" : ""}`}
          >
            Без E
          </Link>
          <Link
            href="/adm/songs?filter=explicit"
            className={`pill admin-filter-link${filter === "explicit" ? " active" : ""}`}
          >
            С E
          </Link>
        </div>
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
            <div className="admin-suggestion-row">
              {item.coverUrl ? (
                <img
                  src={item.coverUrl}
                  alt=""
                  className="admin-suggestion-cover"
                />
              ) : null}
              <div className="admin-suggestion-meta">
                <div className="admin-suggestion-title-row">
                  <div className="admin-suggestion-title">
                    {item.artist} — {item.title}
                    {item.year ? ` (${item.year})` : ""}
                  </div>
                  {item.isExplicit ? (
                    <div className="pill music-explicit-pill">E</div>
                  ) : null}
                </div>
                <div style={{ color: "var(--ink-muted)", marginTop: 4 }}>
                  Запрос: {item.query}
                </div>
                {item.isExplicit ? (
                  <div className="admin-explicit-note">
                    Возможно, песня не пройдет цензуру.
                  </div>
                ) : null}
                <a
                  href={item.yandexUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ display: "inline-block", marginTop: 8 }}
                >
                  Открыть в Яндекс Музыке
                </a>
                <form
                  action={deleteSuggestion}
                  style={{ display: "inline-block", marginTop: 8, marginLeft: 8 }}
                >
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn-ghost" type="submit">
                    Удалить
                  </button>
                </form>
              </div>
              <div className="admin-suggestion-date">
                {item.createdAt.toLocaleString("ru-RU")}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
