import { prisma } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminHomePage() {
  const [mediaCount, reviewsPending, sectionsCount, songsCount] = await Promise.all([
    prisma.media.count(),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.section.count(),
    prisma.songSuggestion.count(),
  ]);

  const stats = [
    {
      label: "Медиа-файлы",
      num: mediaCount,
      icon: "🖼️",
      href: "/adm/media",
      actionText: "Управлять слайдами",
    },
    {
      label: "Отзывы на модерации",
      num: reviewsPending,
      icon: "⭐",
      href: "/adm/reviews",
      actionText: "Перейти к модерации",
      isAlert: reviewsPending > 0,
    },
    {
      label: "Разделы киоска",
      num: sectionsCount,
      icon: "ℹ️",
      href: "/adm/sections",
      actionText: "Редактировать разделы",
    },
    {
      label: "Заявки на песни",
      num: songsCount,
      icon: "🎵",
      href: "/adm/songs",
      actionText: "Посмотреть заявки",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="admin-card">
        <h1>Обзор системы</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: 4 }}>
          Добро пожаловать в панель управления информационным киоском лагеря «Красная Горка».
        </p>
      </div>

      <div className="dashboard-grid">
        {stats.map((stat, i) => (
          <Link href={stat.href} key={i} className="stat-card">
            <div className="stat-icon" style={stat.isAlert ? { background: "#ffebeb", borderColor: "#ffd1d1" } : undefined}>
              {stat.icon}
            </div>
            <div className="stat-info">
              <div 
                className="stat-num" 
                style={stat.isAlert ? { color: "#c53030" } : undefined}
              >
                {stat.num}
              </div>
              <div className="stat-label">{stat.label}</div>
              <span className="stat-action">
                {stat.actionText} &rarr;
              </span>
            </div>
          </Link>
        ))}
      </div>

      {reviewsPending > 0 && (
        <div 
          className="admin-card" 
          style={{ 
            border: "2px solid #fed7d7", 
            background: "#fff5f5", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
            padding: "20px 24px"
          }}
        >
          <div>
            <h3 style={{ color: "#c53030", display: "flex", alignItems: "center", gap: 8 }}>
              ⚠️ Требуется внимание
            </h3>
            <p style={{ color: "#9b2c2c", marginTop: 4, fontSize: 15 }}>
              У вас есть новые отзывы ({reviewsPending}), ожидающие проверки. Они не будут показаны на киоске до тех пор, пока вы их не одобрите.
            </p>
          </div>
          <Link href="/adm/reviews" className="btn-primary" style={{ background: "#c53030", whiteSpace: "nowrap" }}>
            Модерировать отзывы
          </Link>
        </div>
      )}
    </div>
  );
}
