"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CleanupUploadsButton } from "./CleanupUploadsButton";

type Props = {
  username: string;
};

export function AdminSidebar({ username }: Props) {
  const pathname = usePathname();

  const links = [
    { href: "/adm", label: "Обзор", icon: "📈" },
    { href: "/adm/analytics", label: "Статистика", icon: "📊" },
    { href: "/adm/media", label: "Медиа-слайды", icon: "🖼️" },
    { href: "/adm/shifts", label: "Смены и вожатые", icon: "🔄" },
    { href: "/adm/squads", label: "Отряды и дети", icon: "👥" },
    { href: "/adm/ratings", label: "Рейтинг отрядов", icon: "🏆" },
    { href: "/adm/sections", label: "Разделы", icon: "ℹ️" },
    { href: "/adm/reviews", label: "Отзывы", icon: "⭐" },
    { href: "/adm/songs", label: "Песни", icon: "🎵" },
    { href: "/adm/profile", label: "Настройки доступа", icon: "⚙️" },
  ];

  return (
    <nav className="admin-sidebar">
      <div className="admin-sidebar-header">
        <div className="admin-sidebar-logo">🏰 Админка</div>
        <div className="admin-sidebar-user">
          Вы вошли как <strong>{username}</strong>
        </div>
      </div>
      <div className="admin-sidebar-links">
        {links.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`admin-sidebar-link${isActive ? " active" : ""}`}
            >
              <span className="admin-sidebar-link-icon">{link.icon}</span>
              <span className="admin-sidebar-link-label">{link.label}</span>
            </Link>
          );
        })}
        <a href="/adm/logout" className="admin-sidebar-link admin-sidebar-logout">
          <span className="admin-sidebar-link-icon">🚪</span>
          <span className="admin-sidebar-link-label">Выйти</span>
        </a>
      </div>
      <div className="admin-sidebar-footer">
        <CleanupUploadsButton />
      </div>
    </nav>
  );
}
