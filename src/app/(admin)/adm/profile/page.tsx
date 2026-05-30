import crypto from "crypto";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireMainAdmin, hashPassword, verifyPassword } from "@/lib/auth";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function updatePassword(formData: FormData) {
  "use server";
  const user = await requireAdmin();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/adm/profile?tab=profile&error=" + encodeURIComponent("Заполните все поля"));
  }

  if (newPassword !== confirmPassword) {
    redirect("/adm/profile?tab=profile&error=" + encodeURIComponent("Новые пароли не совпадают"));
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    redirect("/adm/profile?tab=profile&error=" + encodeURIComponent("Пользователь не найден"));
  }

  const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
  if (!isValid) {
    redirect("/adm/profile?tab=profile&error=" + encodeURIComponent("Текущий пароль неверен"));
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  redirect("/adm/profile?tab=profile&success=true");
}

async function createAdmin(formData: FormData) {
  "use server";
  await requireMainAdmin();
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return;

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: "ADMIN",
    },
  });
  revalidatePath("/adm/profile");
}

async function deleteAdmin(formData: FormData) {
  "use server";
  await requireMainAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.user.delete({ where: { id } });
  revalidatePath("/adm/profile");
}

const createLink = async () => {
  "use server";
  const user = await requireAdmin();
  const code = crypto.randomBytes(6).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.telegramLink.create({
    data: {
      code,
      userId: user.id,
      expiresAt,
    },
  });

  revalidatePath("/adm/profile");
};

const unlinkTelegram = async (formData: FormData) => {
  "use server";
  const user = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.telegramAdmin.deleteMany({
    where: { id, userId: user.id },
  });
  revalidatePath("/adm/profile");
};

const toggleDj = async (formData: FormData) => {
  "use server";
  const user = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const isDj = formData.get("isDj") === "on";
  await prisma.telegramAdmin.updateMany({
    where: { id, userId: user.id },
    data: { isDj },
  });
  revalidatePath("/adm/profile");
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; success?: string }>;
}) {
  const user = await requireAdmin();
  const params = await searchParams;
  const isMainAdmin = user.role === "MAIN_ADMIN";

  // Validate active tab
  let tab = params.tab === "users" || params.tab === "telegram" ? params.tab : "profile";
  if (tab === "users" && !isMainAdmin) {
    tab = "profile"; // Don't allow non-main admin to access users tab
  }

  // Fetch users list for users tab if needed
  let usersList: any[] = [];
  if (tab === "users") {
    usersList = await prisma.user.findMany({ orderBy: [{ createdAt: "desc" }] });
  }

  // Fetch telegram links/admins list if needed
  let telegramAdmins: any[] = [];
  let activeTelegramLink: any = null;
  if (tab === "telegram") {
    const now = new Date();
    activeTelegramLink = await prisma.telegramLink.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
    telegramAdmins = await prisma.telegramAdmin.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
  }

  return (
    <div className="list" style={{ gap: 20 }}>
      {/* Title Header Card */}
      <div className="admin-card">
        <h1>Настройки доступа</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: 4 }}>
          Управление вашим профилем, списком администраторов системы и привязкой Telegram-бота.
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="admin-tabs">
        <Link href="/adm/profile?tab=profile" className={`admin-tab${tab === "profile" ? " active" : ""}`}>
          👤 Профиль
        </Link>
        {isMainAdmin && (
          <Link href="/adm/profile?tab=users" className={`admin-tab${tab === "users" ? " active" : ""}`}>
            🔑 Администраторы
          </Link>
        )}
        <Link href="/adm/profile?tab=telegram" className={`admin-tab${tab === "telegram" ? " active" : ""}`}>
          💬 Телеграм-бот
        </Link>
      </div>

      {/* Tab: Profile */}
      {tab === "profile" && (
        <div className="admin-card" style={{ maxWidth: 460 }}>
          <h2>Смена пароля</h2>
          <p style={{ color: "var(--ink-muted)", fontSize: 14, marginBottom: 12 }}>
            Обновите пароль для учетной записи <strong>{user.username}</strong> ({user.role === "MAIN_ADMIN" ? "Главный администратор" : "Администратор"}).
          </p>
          
          {params.error && (
            <div style={{ color: "#b1462b", marginTop: 12, marginBottom: 12, fontWeight: 700 }}>
              ⚠️ {params.error}
            </div>
          )}
          
          {params.success && (
            <div style={{ color: "var(--accent-2)", marginTop: 12, marginBottom: 12, fontWeight: 700 }}>
              ✓ Пароль успешно изменён!
            </div>
          )}

          <form action={updatePassword} className="review-form" style={{ marginTop: 16 }}>
            <input
              className="input"
              name="currentPassword"
              type="password"
              placeholder="Текущий пароль"
              required
            />
            <input
              className="input"
              name="newPassword"
              type="password"
              placeholder="Новый пароль"
              required
            />
            <input
              className="input"
              name="confirmPassword"
              type="password"
              placeholder="Подтверждение нового пароля"
              required
            />
            <button className="btn-primary" type="submit" style={{ marginTop: 8 }}>
              Сменить пароль
            </button>
          </form>
        </div>
      )}

      {/* Tab: Users */}
      {tab === "users" && isMainAdmin && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "start" }}>
          {/* Create Admin Form */}
          <div className="admin-card">
            <h2>Создать администратора</h2>
            <p style={{ color: "var(--ink-muted)", fontSize: 14, marginBottom: 12 }}>
              Добавьте новую учетную запись администратора. Новые администраторы смогут управлять всеми разделами, кроме списка пользователей.
            </p>
            <form action={createAdmin} className="review-form">
              <input className="input" name="username" placeholder="Логин" required />
              <input
                className="input"
                name="password"
                type="password"
                placeholder="Пароль"
                required
              />
              <button className="btn-primary" type="submit" style={{ marginTop: 8 }}>
                Создать администратора
              </button>
            </form>
          </div>

          {/* Admins List */}
          <div className="admin-card">
            <h2>Список администраторов ({usersList.length})</h2>
            <div className="list" style={{ marginTop: 16, gap: 12 }}>
              {usersList.map((usr) => (
                <div key={usr.id} className="pill" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px" }}>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 16 }}>{usr.username}</strong>
                    <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 2 }}>
                      Роль: <code>{usr.role === "MAIN_ADMIN" ? "Главный админ" : "Администратор"}</code> · Создан: {usr.createdAt.toLocaleDateString("ru-RU")}
                    </div>
                  </div>
                  {usr.role !== "MAIN_ADMIN" && (
                    <form action={deleteAdmin}>
                      <input type="hidden" name="id" value={usr.id} />
                      <ConfirmButton 
                        className="btn-ghost" 
                        type="submit" 
                        style={{ borderColor: "#b1462b", color: "#b1462b", padding: "8px 12px", fontSize: 13 }}
                        message={`Вы действительно хотите удалить администратора "${usr.username}"?`}
                      >
                        Удалить
                      </ConfirmButton>
                    </form>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Telegram */}
      {tab === "telegram" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24, alignItems: "start" }}>
          {/* Generate Connection Code */}
          <div className="admin-card">
            <h2>Привязать Telegram</h2>
            <p style={{ color: "var(--ink-muted)", fontSize: 14, marginBottom: 12 }}>
              Сгенерируйте код верификации и отправьте его боту в Telegram с помощью команды <code>/link &lt;код&gt;</code>. Это позволит получать уведомления об отзывах и модерировать их через мессенджер.
            </p>
            <form action={createLink} className="review-form">
              <button className="btn-primary" type="submit">
                Сгенерировать код
              </button>
            </form>
            {activeTelegramLink ? (
              <div style={{ marginTop: 16, padding: 16, background: "var(--bg-deep)", borderRadius: 12, border: "1px dashed var(--ink-muted)" }}>
                <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>Отправьте боту код (действует 15 мин):</div>
                <div className="pill" style={{ display: "inline-block", marginTop: 8, fontSize: 18, fontWeight: 700, letterSpacing: 1, padding: "8px 16px" }}>
                  {activeTelegramLink.code}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 16, color: "var(--ink-muted)", fontSize: 13, fontStyle: "italic" }}>Активного кода нет.</div>
            )}
          </div>

          {/* Linked Accounts */}
          <div className="admin-card">
            <h2>Привязанные Telegram-аккаунты ({telegramAdmins.length})</h2>
            <div className="list" style={{ marginTop: 16, gap: 12 }}>
              {telegramAdmins.length === 0 ? (
                <div style={{ color: "var(--ink-muted)", fontStyle: "italic", padding: 8 }}>
                  Пока нет привязанных аккаунтов.
                </div>
              ) : (
                telegramAdmins.map((item) => (
                  <div key={item.id} className="pill" style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16, alignItems: "stretch" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <strong style={{ fontSize: 16 }}>{item.name ?? "Без имени"}</strong>
                        <div style={{ fontSize: 13, color: "var(--ink-muted)", marginTop: 2 }}>
                          {item.username ? `@${item.username}` : `ID: ${item.telegramId}`}
                        </div>
                      </div>
                      <form action={unlinkTelegram}>
                        <input type="hidden" name="id" value={item.id} />
                        <ConfirmButton 
                          className="btn-ghost" 
                          type="submit" 
                          style={{ borderColor: "#b1462b", color: "#b1462b", padding: "6px 12px", fontSize: 13 }}
                          message="Вы действительно хотите отключить уведомления для этого Telegram-аккаунта?"
                        >
                          Отключить
                        </ConfirmButton>
                      </form>
                    </div>

                    <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", paddingTop: 10 }}>
                      <form action={toggleDj} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <input type="hidden" name="id" value={item.id} />
                        <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                          Разрешить этому аккаунту функции DJ (управление песнями через бота)
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              name="isDj"
                              defaultChecked={item.isDj}
                            />
                            DJ
                          </label>
                          <button className="btn-ghost" type="submit" style={{ padding: "6px 12px", fontSize: 13 }}>
                            Сохранить
                          </button>
                        </div>
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
