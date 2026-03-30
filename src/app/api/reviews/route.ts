import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendReviewToTelegram } from "@/lib/telegram";

export async function POST(request: Request) {
  const body = await request.json();
  const rating = Number(body.rating ?? 0);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const message =
    typeof body.message === "string" ? body.message.trim() : "";

  if (
    !message ||
    !name ||
    Number.isNaN(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const review = await prisma.review.create({
    data: {
      rating,
      name,
      message,
    },
  });

  await sendReviewToTelegram({
    id: review.id,
    name: review.name,
    rating: review.rating,
    message: review.message,
    createdAt: review.createdAt,
  });

  return NextResponse.json({ ok: true });
}
