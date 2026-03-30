import { prisma } from "@/lib/db";

export default async function AdminHomePage() {
  const [mediaCount, reviewsPending, sectionsCount] = await Promise.all([
    prisma.media.count(),
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.section.count(),
  ]);

  return (
    <div className="admin-card">
      <h1>Обзор</h1>
      <div className="list" style={{ marginTop: 16 }}>
        <div>Медиа: {mediaCount}</div>
        <div>Отзывы на модерации: {reviewsPending}</div>
        <div>Разделы: {sectionsCount}</div>
      </div>
    </div>
  );
}
