import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { MediaUploadForm } from "@/components/admin/MediaUploadForm";
import { MediaGallery } from "@/components/admin/MediaGallery";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { broadcastRefresh } from "@/lib/broadcast";
import { deleteUploadIfLocal } from "@/lib/media";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function toggleMediaActive(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("isActive") ?? "") === "true";
  if (!id) return;
  await prisma.media.update({
    where: { id },
    data: { isActive: !isActive },
  });
  await broadcastRefresh();
  revalidatePath("/adm/media");
  revalidatePath("/");
}

async function deleteMediaItem(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const item = await prisma.media.findUnique({ where: { id } });
  if (!item) return;
  await prisma.media.delete({ where: { id } });
  await deleteUploadIfLocal(item.url);
  await broadcastRefresh();
  revalidatePath("/adm/media");
  revalidatePath("/");
}

export default async function MediaAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab === "schedule" || params.tab === "menu" ? params.tab : "slides";

  // Query schedule/menu items if needed
  let items: any[] = [];
  if (tab === "schedule") {
    items = await prisma.media.findMany({
      where: { category: "SCHEDULE" },
      orderBy: [{ dateFor: "desc" }, { createdAt: "desc" }],
    });
  } else if (tab === "menu") {
    items = await prisma.media.findMany({
      where: { category: "MENU" },
      orderBy: [{ dateFor: "desc" }, { createdAt: "desc" }],
    });
  }

  return (
    <div className="list" style={{ gap: 20 }}>
      {/* Title Header Card */}
      <div className="admin-card">
        <h1>Медиа-материалы</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: 4 }}>
          Управление изображениями и видео для главного экрана киоска, расписания и меню столовой.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="admin-tabs">
        <Link href="/adm/media?tab=slides" className={`admin-tab${tab === "slides" ? " active" : ""}`}>
          🖼️ Слайды
        </Link>
        <Link href="/adm/media?tab=schedule" className={`admin-tab${tab === "schedule" ? " active" : ""}`}>
          📅 Расписание ({tab === "schedule" ? items.length : await prisma.media.count({ where: { category: "SCHEDULE" } })})
        </Link>
        <Link href="/adm/media?tab=menu" className={`admin-tab${tab === "menu" ? " active" : ""}`}>
          🍲 Меню ({tab === "menu" ? items.length : await prisma.media.count({ where: { category: "MENU" } })})
        </Link>
      </div>

      {/* Tab: Slides */}
      {tab === "slides" && (
        <div className="list">
          <div className="admin-card">
            <h2>Загрузить слайды</h2>
            <p style={{ color: "var(--ink-muted)", fontSize: 14, marginBottom: 12 }}>
              Слайды отображаются на главном экране киоска в виде интерактивного слайд-шоу. Поддерживаются изображения и видео.
            </p>
            <MediaUploadForm endpoint="/api/media/main" mode="main" />
          </div>
          <div className="admin-card">
            <h2>Список загруженных слайдов</h2>
            <MediaGallery category="MAIN" />
          </div>
        </div>
      )}

      {/* Tab: Schedule */}
      {tab === "schedule" && (
        <div className="list" style={{ gap: 24 }}>
          <div className="admin-card">
            <h2>Загрузить расписание (фото)</h2>
            <p style={{ color: "var(--ink-muted)", fontSize: 14, marginBottom: 12 }}>
              Загрузите расписание на определённую дату. Оно отобразится во вкладке «Расписание» на киоске.
            </p>
            <MediaUploadForm endpoint="/api/media/schedule" mode="schedule" />
          </div>

          <div className="admin-card">
            <h2>Список загруженных расписаний ({items.length})</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, marginTop: 16 }}>
              {items.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", color: "var(--ink-muted)", fontStyle: "italic", padding: 12 }}>
                  Расписания не загружены.
                </div>
              ) : (
                items.map((item) => (
                  <div 
                    key={item.id} 
                    className="card" 
                    style={{ 
                      padding: 16, 
                      display: "flex", 
                      flexDirection: "column",
                      gap: 12,
                      border: item.isActive ? "1px solid #f3d6a0" : "1px solid #e2e2e2",
                      background: item.isActive ? "#fff" : "#fafafa",
                      opacity: item.isActive ? 1 : 0.8
                    }}
                  >
                    {/* Image Preview Container */}
                    <div style={{ position: "relative", width: "100%", height: 160, borderRadius: 10, overflow: "hidden", background: "var(--bg-deep)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={item.url} 
                        alt="" 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <div 
                        style={{ 
                          position: "absolute", 
                          top: 8, 
                          left: 8, 
                          padding: "4px 8px", 
                          borderRadius: 6, 
                          fontSize: 12, 
                          fontWeight: 700,
                          background: item.isActive ? "#cfe8d0" : "#e2e2e2",
                          color: item.isActive ? "#1f5f2c" : "#4b4b4b",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
                        }}
                      >
                        {item.isActive ? "🟢 Отображается" : "⚫ Скрыто"}
                      </div>
                    </div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}>
                        📅 {item.dateFor?.toLocaleDateString("ru-RU") ?? "Без даты"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", wordBreak: "break-all" }}>
                        Путь: <code>{item.url}</code>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, borderTop: "1px solid #f5e8d0", paddingTop: 12, marginTop: 4 }}>
                      <form action={toggleMediaActive} style={{ flex: 1 }}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="isActive" value={String(item.isActive)} />
                        <button 
                          className="btn-ghost" 
                          type="submit" 
                          style={{ 
                            width: "100%", 
                            padding: "8px 12px", 
                            fontSize: 13, 
                            borderColor: item.isActive ? "#b1462b" : "var(--accent-2)",
                            color: item.isActive ? "#b1462b" : "var(--accent-2)"
                          }}
                        >
                          {item.isActive ? "Скрыть" : "Показать"}
                        </button>
                      </form>
                      <form action={deleteMediaItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <ConfirmButton 
                          className="btn-ghost" 
                          type="submit" 
                          style={{ 
                            padding: "8px 12px", 
                            fontSize: 13, 
                            borderColor: "#b1462b", 
                            color: "#b1462b" 
                          }}
                          message="Вы действительно хотите удалить это расписание?"
                        >
                          Удалить
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Menu */}
      {tab === "menu" && (
        <div className="list" style={{ gap: 24 }}>
          <div className="admin-card">
            <h2>Загрузить меню (фото)</h2>
            <p style={{ color: "var(--ink-muted)", fontSize: 14, marginBottom: 12 }}>
              Загрузите меню столовой на определённую дату. Оно отобразится во вкладке «Меню» на киоске.
            </p>
            <MediaUploadForm endpoint="/api/media/menu" mode="menu" />
          </div>

          <div className="admin-card">
            <h2>Список загруженных меню ({items.length})</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20, marginTop: 16 }}>
              {items.length === 0 ? (
                <div style={{ gridColumn: "1 / -1", color: "var(--ink-muted)", fontStyle: "italic", padding: 12 }}>
                  Меню не загружены.
                </div>
              ) : (
                items.map((item) => (
                  <div 
                    key={item.id} 
                    className="card" 
                    style={{ 
                      padding: 16, 
                      display: "flex", 
                      flexDirection: "column",
                      gap: 12,
                      border: item.isActive ? "1px solid #f3d6a0" : "1px solid #e2e2e2",
                      background: item.isActive ? "#fff" : "#fafafa",
                      opacity: item.isActive ? 1 : 0.8
                    }}
                  >
                    {/* Image Preview Container */}
                    <div style={{ position: "relative", width: "100%", height: 160, borderRadius: 10, overflow: "hidden", background: "var(--bg-deep)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img 
                        src={item.url} 
                        alt="" 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <div 
                        style={{ 
                          position: "absolute", 
                          top: 8, 
                          left: 8, 
                          padding: "4px 8px", 
                          borderRadius: 6, 
                          fontSize: 12, 
                          fontWeight: 700,
                          background: item.isActive ? "#cfe8d0" : "#e2e2e2",
                          color: item.isActive ? "#1f5f2c" : "#4b4b4b",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
                        }}
                      >
                        {item.isActive ? "🟢 Отображается" : "⚫ Скрыто"}
                      </div>
                    </div>

                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 6 }}>
                        📅 {item.dateFor?.toLocaleDateString("ru-RU") ?? "Без даты"}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", wordBreak: "break-all" }}>
                        Путь: <code>{item.url}</code>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, borderTop: "1px solid #f5e8d0", paddingTop: 12, marginTop: 4 }}>
                      <form action={toggleMediaActive} style={{ flex: 1 }}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="isActive" value={String(item.isActive)} />
                        <button 
                          className="btn-ghost" 
                          type="submit" 
                          style={{ 
                            width: "100%", 
                            padding: "8px 12px", 
                            fontSize: 13, 
                            borderColor: item.isActive ? "#b1462b" : "var(--accent-2)",
                            color: item.isActive ? "#b1462b" : "var(--accent-2)"
                          }}
                        >
                          {item.isActive ? "Скрыть" : "Показать"}
                        </button>
                      </form>
                      <form action={deleteMediaItem}>
                        <input type="hidden" name="id" value={item.id} />
                        <ConfirmButton 
                          className="btn-ghost" 
                          type="submit" 
                          style={{ 
                            padding: "8px 12px", 
                            fontSize: 13, 
                            borderColor: "#b1462b", 
                            color: "#b1462b" 
                          }}
                          message="Вы действительно хотите удалить это меню?"
                        >
                          Удалить
                        </ConfirmButton>
                      </form>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
