import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

const username = (process.env.MAIN_ADMIN_USER ?? "admin").trim();
const password = (process.env.MAIN_ADMIN_PASS ?? "admin123").trim();

async function main() {
  if (!username || !password) {
    throw new Error("MAIN_ADMIN_USER and MAIN_ADMIN_PASS must be set");
  }

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findFirst({
    where: { role: "MAIN_ADMIN" },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: "MAIN_ADMIN",
      },
    });
    console.log("MAIN_ADMIN created:", username);
    return;
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: {
      username,
      passwordHash,
    },
  });

  console.log("MAIN_ADMIN reset:", username);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
