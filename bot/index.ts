import { Telegraf } from "telegraf";
import crypto from "crypto";
import path from "path";
import fetch from "node-fetch";
import { SocksProxyAgent } from "socks-proxy-agent";
import { prisma } from "../src/lib/db";
import { broadcastRefresh } from "../src/lib/broadcast";
import { saveBuffer } from "../src/lib/media";

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminIds = (process.env.TELEGRAM_ADMIN_IDS ?? "")
  .split(",")
  .map((value) => Number.parseInt(value.trim(), 10))
  .filter((value) => Number.isFinite(value));

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set");
}

const proxyUrl = process.env.TELEGRAM_SOCKS_PROXY;
const agent = proxyUrl ? new SocksProxyAgent(proxyUrl) : undefined;

const bot = new Telegraf(token, {
  telegram: {
    agent,
  },
});

type PendingUpload = {
  category: "MENU" | "SCHEDULE";
  dateFor: Date;
  expiresAt: number;
};

const pendingUploads = new Map<number, PendingUpload>();
const PENDING_TTL_MS = 10 * 60 * 1000;

const isAdmin = async (id?: number) => {
  if (typeof id !== "number") return false;
  if (adminIds.includes(id)) return true;
  const linked = await prisma.telegramAdmin.findUnique({
    where: { telegramId: String(id) },
    select: { id: true },
  });
  return Boolean(linked);
};

const guard = async (ctx: any) => {
  const id = ctx.from?.id;
  if (!(await isAdmin(id))) {
    await ctx.reply("Доступ ограничен. Этот бот только для администраторов.");
    return false;
  }
  return true;
};

const parseDate = (raw: string) => {
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const extractCommandArg = (text: string | undefined) => {
  if (!text) return "";
  const parts = text.trim().split(/\s+/);
  return parts[1] ?? "";
};

const getMessageText = (ctx: any) => {
  const msg = ctx.message ?? ctx.update?.message;
  if (!msg) return "";
  return typeof msg.text === "string"
    ? msg.text
    : typeof msg.caption === "string"
      ? msg.caption
      : "";
};

const getFileInfo = (ctx: any) => {
  const msg = ctx.message ?? ctx.update?.message;
  if (!msg) return null;
  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    const best = msg.photo[msg.photo.length - 1];
    return { fileId: best.file_id as string, fileName: "photo.jpg" };
  }
  if (msg.document && typeof msg.document.file_id === "string") {
    const mime = msg.document.mime_type ?? "";
    if (!mime.startsWith("image/")) return null;
    return {
      fileId: msg.document.file_id as string,
      fileName: msg.document.file_name ?? "file.jpg",
    };
  }
  return null;
};

const downloadTelegramFile = async (fileId: string) => {
  const file = await bot.telegram.getFile(fileId);
  if (!file.file_path) return null;
  const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
  const res = await fetch(url, agent ? { agent } : undefined);
  if (!res.ok) return null;
  const buffer = await res.buffer();
  return { buffer, filePath: file.file_path };
};

const buildDateKeyboard = (category: "MENU" | "SCHEDULE") => {
  const today = new Date();
  const buttons = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const label = d.toLocaleDateString("ru-RU");
    const key = d.toISOString().slice(0, 10);
    return { text: label, callback_data: `pick:${category}:${key}` };
  });
  const rows: { text: string; callback_data: string }[][] = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  return { reply_markup: { inline_keyboard: rows } };
};

const handlePendingUpload = async (ctx: any) => {
  const id = ctx.from?.id;
  if (typeof id !== "number") return;
  const pending = pendingUploads.get(id);
  if (!pending) return;
  if (pending.expiresAt < Date.now()) {
    pendingUploads.delete(id);
    return;
  }
  const info = getFileInfo(ctx);
  if (!info) return;
  await handleMediaUploadWithDate(ctx, pending.category, pending.dateFor);
  pendingUploads.delete(id);
};

const handleMediaUploadWithDate = async (
  ctx: any,
  category: "MENU" | "SCHEDULE",
  dateFor: Date
) => {
  if (!(await guard(ctx))) return;
  const info = getFileInfo(ctx);
  if (!info) {
    await ctx.reply("Прикрепите изображение к сообщению.");
    return;
  }
  const downloaded = await downloadTelegramFile(info.fileId);
  if (!downloaded) {
    await ctx.reply("Не удалось скачать файл из Telegram.");
    return;
  }
  const ext =
    path.extname(downloaded.filePath) || path.extname(info.fileName) || ".jpg";
  const fileName = `${crypto.randomUUID()}${ext}`;
  const url = await saveBuffer(downloaded.buffer, fileName);

  await prisma.media.create({
    data: {
      url,
      type: "PHOTO",
      category,
      dateFor,
    },
  });

  await broadcastRefresh();
  await ctx.reply("Файл загружен и привязан к дате.");
};

const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: "/stats" }, { text: "/refresh" }],
      [{ text: "/menu" }, { text: "/schedule" }],
      [{ text: "/link" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

bot.start((ctx) =>
  ctx.reply(
    "Бот киоска запущен.\n\nДоступные команды:\n/help\n/ping\n/stats\n/refresh\n/menu YYYY-MM-DD\n/schedule YYYY-MM-DD\n/link КОД",
    mainKeyboard
  )
);

bot.command("help", (ctx) =>
  ctx.reply(
    "Команды:\n" +
      "/ping — проверка связи\n" +
      "/stats — краткая статистика\n" +
      "/refresh — принудительно обновить киоск\n" +
      "/menu YYYY-MM-DD — загрузить фото меню\n" +
      "/schedule YYYY-MM-DD — загрузить фото расписания\n" +
      "/link КОД — привязать Telegram к админке",
    mainKeyboard
  )
);

bot.command("ping", (ctx) => ctx.reply("pong"));

bot.command("stats", async (ctx) => {
  if (!(await guard(ctx))) return;
  const [pendingReviews, mediaCount, sectionsCount] = await Promise.all([
    prisma.review.count({ where: { status: "PENDING" } }),
    prisma.media.count(),
    prisma.section.count({ where: { isActive: true } }),
  ]);
  await ctx.reply(
    `Статистика:\n` +
      `Новые отзывы: ${pendingReviews}\n` +
      `Медиа файлов: ${mediaCount}\n` +
      `Активных разделов: ${sectionsCount}`
  );
});

bot.command("refresh", async (ctx) => {
  if (!(await guard(ctx))) return;
  const url = process.env.WS_BROADCAST_URL;
  if (!url) {
    await ctx.reply("WS_BROADCAST_URL не задан.");
    return;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "refresh" }),
    });
    if (!res.ok) throw new Error("bad response");
    await ctx.reply("Запрос на обновление отправлен.");
  } catch {
    await ctx.reply("Не удалось отправить обновление. Проверьте ws-сервис.");
  }
});

bot.command("menu", async (ctx) => {
  const text = getMessageText(ctx);
  const dateRaw = extractCommandArg(text);
  const dateFor = parseDate(dateRaw);
  if (!dateFor) {
    await ctx.reply("Выберите дату для меню:", buildDateKeyboard("MENU"));
    return;
  }
  await handleMediaUploadWithDate(ctx, "MENU", dateFor);
});

bot.command("schedule", async (ctx) => {
  const text = getMessageText(ctx);
  const dateRaw = extractCommandArg(text);
  const dateFor = parseDate(dateRaw);
  if (!dateFor) {
    await ctx.reply("Выберите дату для расписания:", buildDateKeyboard("SCHEDULE"));
    return;
  }
  await handleMediaUploadWithDate(ctx, "SCHEDULE", dateFor);
});

bot.command("link", async (ctx) => {
  const text = getMessageText(ctx);
  const code = extractCommandArg(text);
  if (!code) {
    await ctx.reply("Использование: /link ВАШ_КОД");
    return;
  }
  const link = await prisma.telegramLink.findFirst({
    where: {
      code,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!link) {
    await ctx.reply("Код недействителен или истёк.");
    return;
  }
  const telegramId = String(ctx.from?.id ?? "");
  if (!telegramId) {
    await ctx.reply("Не удалось определить ваш Telegram ID.");
    return;
  }

  const username =
    typeof ctx.from?.username === "string" ? ctx.from.username : null;
  const nameParts = [
    typeof ctx.from?.first_name === "string" ? ctx.from.first_name : "",
    typeof ctx.from?.last_name === "string" ? ctx.from.last_name : "",
  ].filter(Boolean);
  const name = nameParts.length > 0 ? nameParts.join(" ") : null;

  await prisma.$transaction([
    prisma.telegramAdmin.upsert({
      where: { telegramId },
      update: { userId: link.userId, username, name },
      create: { telegramId, userId: link.userId, username, name },
    }),
    prisma.telegramLink.update({
      where: { id: link.id },
      data: { usedAt: new Date(), telegramId },
    }),
  ]);

  await ctx.reply("Успешно привязано. Теперь доступны команды бота.");
});

bot.on("callback_query", async (ctx) => {
  const id = ctx.from?.id;
  if (!(await isAdmin(id))) {
    await ctx.answerCbQuery("Нет доступа", { show_alert: true });
    return;
  }
  const data = "data" in ctx.callbackQuery ? ctx.callbackQuery.data : "";
  if (data?.startsWith("pick:")) {
    const [, category, date] = data.split(":");
    const dateFor = parseDate(date ?? "");
    if (!dateFor || (category !== "MENU" && category !== "SCHEDULE")) {
      await ctx.answerCbQuery("Некорректная дата");
      return;
    }
    if (typeof id === "number") {
      pendingUploads.set(id, {
        category,
        dateFor,
        expiresAt: Date.now() + PENDING_TTL_MS,
      });
    }
    await ctx.answerCbQuery("Ок, теперь пришлите фото");
    try {
      await ctx.editMessageReplyMarkup(undefined);
    } catch {}
    return;
  }
  if (!data?.startsWith("review:")) {
    await ctx.answerCbQuery();
    return;
  }
  const [, action, reviewId] = data.split(":");
  if (!reviewId) {
    await ctx.answerCbQuery("Некорректные данные");
    return;
  }
  const nextStatus = action === "approve" ? "APPROVED" : "REJECTED";
  await prisma.review.update({
    where: { id: reviewId },
    data: { status: nextStatus },
  });
  await broadcastRefresh();
  await ctx.answerCbQuery(
    nextStatus === "APPROVED" ? "Одобрено" : "Отклонено"
  );
  try {
    await ctx.editMessageReplyMarkup(undefined);
  } catch {}
});

bot.on("photo", async (ctx) => {
  await handlePendingUpload(ctx);
});

bot.on("document", async (ctx) => {
  await handlePendingUpload(ctx);
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
