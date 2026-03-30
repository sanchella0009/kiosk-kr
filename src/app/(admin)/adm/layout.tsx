import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CleanupUploadsButton } from "@/components/admin/CleanupUploadsButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAdmin();

  return (
    <div className="admin-layout">
      <nav className="admin-nav">
        <h2>Админка</h2>
        <p>Вы вошли как {user.username}</p>
        <div className="list" style={{ marginTop: 16 }}>
          <Link href="/adm">Обзор</Link>
          <Link href="/adm/media">Медиа</Link>
          <Link href="/adm/schedule">Расписание</Link>
          <Link href="/adm/menu">Меню</Link>
          <Link href="/adm/shifts">Смены</Link>
          <Link href="/adm/sections">Разделы</Link>
          <Link href="/adm/reviews">Отзывы</Link>
          <Link href="/adm/songs">Песни</Link>
          <Link href="/adm/telegram">Телеграм</Link>
          <Link href="/adm/users">Администраторы</Link>
          <Link href="/adm/profile">Профиль</Link>
          <a href="/adm/logout">Выйти</a>
        </div>
        <CleanupUploadsButton />
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}
