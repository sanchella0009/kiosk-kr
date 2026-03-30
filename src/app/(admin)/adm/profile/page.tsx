import { prisma } from "@/lib/db";
import { requireAdmin, hashPassword, verifyPassword } from "@/lib/auth";
import { redirect } from "next/navigation";

async function updatePassword(formData: FormData) {
  "use server";
  const user = await requireAdmin();

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    redirect("/adm/profile?error=" + encodeURIComponent("Заполните все поля"));
  }

  if (newPassword !== confirmPassword) {
    redirect("/adm/profile?error=" + encodeURIComponent("Новые пароли не совпадают"));
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) {
    redirect("/adm/profile?error=" + encodeURIComponent("Пользователь не найден"));
  }

  const isValid = await verifyPassword(currentPassword, dbUser.passwordHash);
  if (!isValid) {
    redirect("/adm/profile?error=" + encodeURIComponent("Текущий пароль неверен"));
  }

  const newHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  redirect("/adm/profile?success=true");
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  await requireAdmin();
  const params = await searchParams;

  return (
    <div className="admin-card" style={{ maxWidth: 400 }}>
      <h1>Смена пароля</h1>
      
      {params.error && (
        <div style={{ color: "red", marginTop: 12, marginBottom: 12 }}>
          {params.error}
        </div>
      )}
      
      {params.success && (
        <div style={{ color: "green", marginTop: 12, marginBottom: 12 }}>
          Пароль успешно изменён!
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
        <button className="btn-primary" type="submit">
          Сменить пароль
        </button>
      </form>
    </div>
  );
}
