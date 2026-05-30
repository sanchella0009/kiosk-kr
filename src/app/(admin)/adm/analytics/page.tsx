import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AnalyticsAdminPage() {
  const [totalVisits, totalClicks, uniqueKiosksCount] = await Promise.all([
    prisma.kioskAnalytics.count({ where: { type: "VISIT" } }),
    prisma.kioskAnalytics.count({ where: { type: "CLICK" } }),
    prisma.kioskAnalytics.groupBy({
      by: ["kioskId"],
    }).then((res) => res.length),
  ]);

  // Click targets stats
  const clicksGrouped = await prisma.kioskAnalytics.groupBy({
    by: ["target"],
    where: { type: "CLICK" },
    _count: { id: true },
  });

  // Target translation map for presentation
  const targetMap: Record<string, string> = {
    schedule: "📅 Расписание",
    menu: "🍲 Меню",
    review: "⭐ Отзывы",
    music: "🎵 Предложить песню",
    counselors: "👥 Сотрудники смены",
  };

  const formattedClicks = clicksGrouped.map((item) => {
    let name = item.target;
    if (targetMap[item.target]) {
      name = targetMap[item.target];
    } else if (item.target.startsWith("section:")) {
      name = `ℹ️ Раздел: ${item.target.replace("section:", "")}`;
    }
    return {
      name,
      count: item._count.id,
    };
  }).sort((a, b) => b.count - a.count);

  const maxClickCount = formattedClicks.length > 0 ? Math.max(...formattedClicks.map((c) => c.count)) : 1;

  // Active kiosks table
  const kiosksGrouped = await prisma.kioskAnalytics.groupBy({
    by: ["kioskId"],
    _count: { id: true },
    _max: { createdAt: true },
  });

  const activeKiosks = kiosksGrouped.map((kiosk) => {
    const lastActive = kiosk._max.createdAt ? new Date(kiosk._max.createdAt) : null;
    const isOnline = lastActive ? (Date.now() - lastActive.getTime() < 5 * 60 * 1000) : false;
    return {
      id: kiosk.kioskId,
      eventCount: kiosk._count.id,
      lastActive,
      isOnline,
    };
  }).sort((a, b) => (b.lastActive?.getTime() ?? 0) - (a.lastActive?.getTime() ?? 0));

  // Daily visits breakdown (Last 7 Days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const recentVisits = await prisma.kioskAnalytics.findMany({
    where: {
      type: "VISIT",
      createdAt: { gte: sevenDaysAgo },
    },
    select: { createdAt: true },
  });

  const dailyCounts: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    dailyCounts[key] = 0;
  }

  recentVisits.forEach((visit) => {
    const key = visit.createdAt.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
    if (dailyCounts[key] !== undefined) {
      dailyCounts[key]++;
    }
  });

  const chartData = Object.entries(dailyCounts)
    .reverse()
    .map(([label, count]) => ({ label, count }));

  const maxVisitCount = chartData.length > 0 ? Math.max(...chartData.map((d) => d.count)) : 1;

  return (
    <div className="list" style={{ gap: 24 }}>
      {/* Title Header Card */}
      <div className="admin-card">
        <h1>📊 Статистика использования</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: 4 }}>
          Показатели посещаемости киосков, популярности разделов меню и активности устройств в режиме реального времени.
        </p>
      </div>

      {/* Grid of Key Metrics */}
      <div className="dashboard-grid" style={{ marginTop: 0 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#eef2ff", borderColor: "#c7d2fe" }}>👥</div>
          <div className="stat-info">
            <div className="stat-num">{totalVisits}</div>
            <div className="stat-label">Всего посещений</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#ecfdf5", borderColor: "#a7f3d0" }}>🖥️</div>
          <div className="stat-info">
            <div className="stat-num">{uniqueKiosksCount}</div>
            <div className="stat-label">Уникальных киосков</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#fff7ed", borderColor: "#ffedd5" }}>⚡</div>
          <div className="stat-info">
            <div className="stat-num">{totalClicks}</div>
            <div className="stat-label">Взаимодействий (кликов)</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 24, alignItems: "start" }}>
        {/* Click Popularity */}
        <div className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2>Популярность разделов</h2>
          <div style={{ display: "grid", gap: 16, marginTop: 8 }}>
            {formattedClicks.length === 0 ? (
              <div style={{ color: "var(--ink-muted)", fontStyle: "italic", padding: 8 }}>
                Кликов по кнопкам пока не зафиксировано.
              </div>
            ) : (
              formattedClicks.map((click, index) => {
                const percentage = Math.round((click.count / maxClickCount) * 100);
                return (
                  <div key={index} style={{ display: "grid", gap: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 700 }}>
                      <span>{click.name}</span>
                      <span style={{ color: "var(--accent)" }}>{click.count}</span>
                    </div>
                    <div style={{ height: 12, background: "var(--bg-deep)", borderRadius: 6, overflow: "hidden" }}>
                      <div 
                        style={{ 
                          height: "100%", 
                          width: `${percentage}%`, 
                          background: "var(--accent)", 
                          borderRadius: 6,
                          transition: "width 0.5s ease" 
                        }} 
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Daily Visits Chart */}
        <div className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2>Активность по дням (визиты)</h2>
          <div 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "flex-end", 
              height: 180, 
              padding: "24px 10px 10px 10px", 
              background: "#fffdf9", 
              borderRadius: 14, 
              border: "2px solid #f3e4cc",
              marginTop: 8
            }}
          >
            {chartData.map((day, i) => {
              // Calculate height between 10% and 100% of container height (130px max bar height)
              const height = maxVisitCount > 0 ? Math.max(10, Math.round((day.count / maxVisitCount) * 120)) : 10;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>
                    {day.count}
                  </span>
                  <div 
                    style={{ 
                      width: 24, 
                      height: height, 
                      background: "var(--accent)", 
                      borderRadius: "6px 6px 0 0",
                      transition: "height 0.3s ease",
                      boxShadow: "0 2px 6px rgba(232, 106, 51, 0.15)"
                    }} 
                  />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Connected Kiosks Table */}
      <div className="admin-card">
        <h2>Список активных киосков ({activeKiosks.length})</h2>
        <div style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--bg-deep)", color: "var(--ink-muted)", fontWeight: 700, fontSize: 14 }}>
                <th style={{ padding: "12px 16px" }}>Идентификатор киоска</th>
                <th style={{ padding: "12px 16px" }}>Статус</th>
                <th style={{ padding: "12px 16px" }}>Всего событий</th>
                <th style={{ padding: "12px 16px" }}>Последняя активность</th>
              </tr>
            </thead>
            <tbody>
              {activeKiosks.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--ink-muted)", fontStyle: "italic" }}>
                    Устройства пока не подключались.
                  </td>
                </tr>
              ) : (
                activeKiosks.map((kiosk) => (
                  <tr 
                    key={kiosk.id} 
                    style={{ 
                      borderBottom: "1px solid var(--bg-deep)", 
                      fontSize: 15,
                      background: kiosk.isOnline ? "rgba(207, 232, 208, 0.1)" : "transparent"
                    }}
                  >
                    <td style={{ padding: "14px 16px", fontWeight: 700 }}>
                      🖥️ {kiosk.id}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span 
                        style={{ 
                          display: "inline-flex", 
                          alignItems: "center", 
                          gap: 6, 
                          fontSize: 13, 
                          fontWeight: 700,
                          color: kiosk.isOnline ? "#1f5f2c" : "var(--ink-muted)" 
                        }}
                      >
                        <span 
                          style={{ 
                            width: 8, 
                            height: 8, 
                            borderRadius: "50%", 
                            background: kiosk.isOnline ? "#22c55e" : "#9ca3af" 
                          }} 
                        />
                        {kiosk.isOnline ? "В сети (Online)" : "Не в сети"}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", color: "var(--accent)", fontWeight: 700 }}>
                      {kiosk.eventCount}
                    </td>
                    <td style={{ padding: "14px 16px", color: "var(--ink-muted)" }}>
                      {kiosk.lastActive ? kiosk.lastActive.toLocaleString("ru-RU") : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
