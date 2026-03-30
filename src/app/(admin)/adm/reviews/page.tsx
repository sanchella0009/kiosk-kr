import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { broadcastRefresh } from "@/lib/broadcast";

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

  return (
    <div className="admin-card">
      <h1>Отзывы</h1>
      <div className="list" style={{ marginTop: 16 }}>
        {reviews.length === 0 && <div>Пока нет отзывов.</div>}
        {reviews.map((review) => (
          <div key={review.id} className="card" style={{ padding: 16 }}>
            <div>
              {"★".repeat(review.rating)}{" "}
              <strong>{review.name || "Гость"}</strong>
            </div>
            <div style={{ marginTop: 6 }}>{review.message}</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <span>Статус: {review.status}</span>
              {review.status === "PENDING" && (
                <>
                  <form action={updateReviewStatus}>
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="status" value="APPROVED" />
                    <button className="btn-ghost" type="submit">
                      Одобрить
                    </button>
                  </form>
                  <form action={updateReviewStatus}>
                    <input type="hidden" name="id" value={review.id} />
                    <input type="hidden" name="status" value="REJECTED" />
                    <button className="btn-ghost" type="submit">
                      Отклонить
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
