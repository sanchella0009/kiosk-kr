import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { hashPassword, verifyPassword } from "@/lib/password";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "kiosk_session";
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? "48");

const addHours = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000);

export { hashPassword, verifyPassword };

export const createSession = async (userId: string) => {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = addHours(SESSION_TTL_HOURS);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    secure: false,
  });
};

export const clearSession = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    secure: false,
  });
};

export const getSessionUser = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.deleteMany({ where: { token } });
    return null;
  }

  return session.user;
};

export const requireAdmin = async () => {
  const user = await getSessionUser();
  if (!user) {
    redirect("/adm/login");
  }
  return user;
};

export const requireMainAdmin = async () => {
  const user = await requireAdmin();
  if (user.role !== UserRole.MAIN_ADMIN) {
    redirect("/adm");
  }
  return user;
};
