import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  revalidatePath("/adm/telegram");
};

const unlinkTelegram = async (formData: FormData) => {
  "use server";
  const user = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.telegramAdmin.deleteMany({
    where: { id, userId: user.id },
  });
  revalidatePath("/adm/telegram");
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
  revalidatePath("/adm/telegram");
};

export default async function TelegramAdminPage() {
  const user = await requireAdmin();
  const now = new Date();
  const activeLink = await prisma.telegramLink.findFirst({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });
  const linked = await prisma.telegramAdmin.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="list">
      <div className="admin-card">
        <h1>Телеграм бот</h1>
        <p>Сгенерируйте код и отправьте его боту командой /link.</p>
        <form action={createLink} className="review-form" style={{ maxWidth: 320 }}>
          <button className="btn-primary" type="submit">
            Сгенерировать код
          </button>
        </form>
        {activeLink ? (
          <div style={{ marginTop: 12 }}>
            <div>Активный код (15 минут):</div>
            <div className="pill" style={{ marginTop: 8 }}>
              {activeLink.code}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>Активного кода нет.</div>
        )}
      </div>

      <div className="admin-card">
        <h2>Привязанные аккаунты</h2>
        {linked.length === 0 ? (
          <div>Пока нет привязанных аккаунтов.</div>
        ) : (
          <div className="list" style={{ marginTop: 12 }}>
            {linked.map((item) => (
              <div key={item.id} className="pill" style={{ gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div>{item.name ?? "Без имени"}</div>
                  <div style={{ color: "var(--ink-muted)" }}>
                    {item.username ? `@${item.username}` : "ID скрыт"}
                  </div>
                </div>
                <form action={toggleDj} style={{ display: "flex", gap: 8 }}>
                  <input type="hidden" name="id" value={item.id} />
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      name="isDj"
                      defaultChecked={item.isDj}
                    />
                    DJ
                  </label>
                  <button className="btn-ghost" type="submit">
                    Сохранить
                  </button>
                </form>
                <form action={unlinkTelegram}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn-ghost" type="submit">
                    Удалить привязку
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
