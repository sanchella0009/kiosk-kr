import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { broadcastRefresh } from "@/lib/broadcast";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function updateReviewStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["APPROVED", "REJECTED"].includes(status)) return;

  await prisma.review.update({
    where: { id },
    data: { status: status === "APPROVED" ? "APPROVED" : "REJECTED" },
  });
  await broadcastRefresh();
  revalidatePath("/adm/reviews");
}

export default async function ReviewsAdminPage() {
  const reviews = await prisma.review.findMany({
    orderBy: [{ createdAt: "desc" }],
  });

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "APPROVED":
        return { background: "#cfe8d0", color: "#1f5f2c", text: "Одобрен" };
      case "REJECTED":
        return { background: "#ffebeb", color: "#c53030", text: "Отклонен" };
      default:
        return { background: "#fff6e5", color: "#8a5816", text: "Ожидает проверки" };
    }
  };

  return (
    <div className="list" style={{ gap: 24 }}>
      <div className="admin-card">
        <h1>Отзывы детей и гостей</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: 4 }}>
          Модерируйте отзывы, присланные с киоска. Только одобренные отзывы показываются в слайдере отзывов.
        </p>
      </div>

      <div className="admin-card">
        <h2>Все отзывы ({reviews.length})</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 20, marginTop: 16 }}>
          {reviews.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", color: "var(--ink-muted)", fontStyle: "italic", padding: 12 }}>
              Отзывов пока нет.
            </div>
          ) : (
            reviews.map((review) => {
              const badge = getStatusBadgeStyle(review.status);
              return (
                <div 
                  key={review.id} 
                  className="card" 
                  style={{ 
                    padding: 20, 
                    display: "flex", 
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 14,
                    border: "1px solid #f3d6a0",
                    background: "#fff",
                    boxShadow: "0 4px 12px var(--shadow)"
                  }}
                >
                  <div>
                    {/* Header: Stars & Status */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                      <div style={{ color: "#ffd700", fontSize: 20, letterSpacing: 2 }}>
                        {"★".repeat(review.rating)}
                        <span style={{ color: "#e2e2e2" }}>{"★".repeat(5 - review.rating)}</span>
                      </div>
                      <span 
                        style={{ 
                          background: badge.background, 
                          color: badge.color, 
                          fontSize: 12, 
                          fontWeight: 700, 
                          padding: "4px 10px", 
                          borderRadius: 8 
                        }}
                      >
                        {badge.text}
                      </span>
                    </div>

                    {/* Author Name */}
                    <div style={{ fontWeight: 700, fontSize: 16, marginTop: 12 }}>
                      👤 {review.name || "Анонимный гость"}
                    </div>

                    {/* Message Body */}
                    <div 
                      style={{ 
                        marginTop: 10, 
                        fontSize: 15, 
                        lineHeight: 1.5, 
                        color: "var(--ink)", 
                        background: "#fffdf9",
                        borderLeft: "3px solid var(--accent)",
                        paddingLeft: 12,
                        paddingTop: 4,
                        paddingBottom: 4,
                        fontStyle: "italic"
                      }}
                    >
                      "{review.message}"
                    </div>
                  </div>

                  {/* Footer actions / info */}
                  <div 
                    style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between", 
                      gap: 12,
                      borderTop: "1px solid #f5e8d0", 
                      paddingTop: 14,
                      marginTop: 8
                    }}
                  >
                    <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                      🕒 {review.createdAt.toLocaleString("ru-RU")}
                    </div>

                    {review.status === "PENDING" && (
                      <div style={{ display: "flex", gap: 8 }}>
                        <form action={updateReviewStatus}>
                          <input type="hidden" name="id" value={review.id} />
                          <input type="hidden" name="status" value="APPROVED" />
                          <button 
                            className="btn-primary" 
                            type="submit" 
                            style={{ 
                              padding: "6px 12px", 
                              fontSize: 13, 
                              background: "var(--accent-2)", 
                              borderRadius: 10 
                            }}
                          >
                            Одобрить
                          </button>
                        </form>
                        <form action={updateReviewStatus}>
                          <input type="hidden" name="id" value={review.id} />
                          <input type="hidden" name="status" value="REJECTED" />
                          <button 
                            className="btn-ghost" 
                            type="submit" 
                            style={{ 
                              padding: "6px 12px", 
                              fontSize: 13, 
                              borderColor: "#b1462b", 
                              color: "#b1462b",
                              borderRadius: 10 
                            }}
                          >
                            Отклонить
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
