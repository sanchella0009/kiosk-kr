import { prisma } from "@/lib/db";

type ReviewPayload = {
  id: string;
  name: string | null;
  rating: number;
  message: string;
  createdAt: Date;
};

const token = process.env.TELEGRAM_BOT_TOKEN ?? "";

const buildReviewText = (review: ReviewPayload) => {
  const stars = "★".repeat(review.rating);
  const name = review.name?.trim() || "Гость";
  const created = review.createdAt.toLocaleString("ru-RU");
  return (
    `Новый отзыв (${created})\n` +
    `${stars} ${name}\n\n` +
    `${review.message}\n\n` +
    `ID: ${review.id}`
  );
};

export const sendReviewToTelegram = async (review: ReviewPayload) => {
  if (!token) return;
  const admins = await prisma.telegramAdmin.findMany({
    select: { telegramId: true },
  });
  if (admins.length === 0) return;

  const text = buildReviewText(review);
  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Одобрить", callback_data: `review:approve:${review.id}` },
        { text: "❌ Отклонить", callback_data: `review:reject:${review.id}` },
      ],
    ],
  };

  await Promise.all(
    admins.map((admin) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: admin.telegramId,
          text,
          reply_markup: keyboard,
        }),
      }).catch(() => null)
    )
  );
};

type SongSuggestionPayload = {
  id: string;
  artist: string;
  title: string;
  year: number | null;
  yandexUrl: string;
  isExplicit: boolean;
};

export const sendSongSuggestionToTelegram = async (
  suggestion: SongSuggestionPayload
) => {
  if (!token) return;
  const djs = await prisma.telegramAdmin.findMany({
    where: { isDj: true },
    select: { telegramId: true },
  });
  if (djs.length === 0) return;
  const year = suggestion.year ? ` (${suggestion.year})` : "";
  const moderationNote = suggestion.isExplicit
    ? `\n⚠️ Возможно, песня не пройдет цензуру: у трека есть метка E.\n`
    : "\n";
  const text =
    `Новая заявка на песню:\n` +
    `${suggestion.artist} — ${suggestion.title}${year}\n` +
    moderationNote +
    `Ссылка: ${suggestion.yandexUrl}\n` +
    `ID: ${suggestion.id}`;

  await Promise.all(
    djs.map((dj) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: dj.telegramId,
          text,
        }),
      }).catch(() => null)
    )
  );
};
