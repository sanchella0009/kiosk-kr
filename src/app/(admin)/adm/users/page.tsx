import { prisma } from "@/lib/db";
import { hashPassword, requireMainAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
  revalidatePath("/adm/users");
}

async function deleteAdmin(formData: FormData) {
  "use server";
  await requireMainAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.user.delete({ where: { id } });
  revalidatePath("/adm/users");
}

export default async function UsersAdminPage() {
  const currentUser = await requireMainAdmin();
  const users = await prisma.user.findMany({ orderBy: [{ createdAt: "desc" }] });

  return (
    <div className="list">
      <div className="admin-card">
        <h1>Администраторы</h1>
        <p style={{ color: "var(--ink-muted)" }}>
          Главный админ: {currentUser.username}
        </p>
        <form action={createAdmin} className="review-form">
          <input className="input" name="username" placeholder="Логин" />
          <input
            className="input"
            name="password"
            type="password"
            placeholder="Пароль"
          />
          <button className="btn-primary" type="submit">
            Создать администратора
          </button>
        </form>
      </div>
      <div className="admin-card">
        <h2>Список</h2>
        <div className="list" style={{ marginTop: 12 }}>
          {users.map((user) => (
            <div key={user.id} className="pill">
              <div style={{ flex: 1 }}>
                {user.username} · {user.role}
              </div>
              {user.role !== "MAIN_ADMIN" && (
                <form action={deleteAdmin}>
                  <input type="hidden" name="id" value={user.id} />
                  <button className="btn-ghost" type="submit">
                    Удалить
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
