import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

const username = process.env.MAIN_ADMIN_USER ?? "admin";
const password = process.env.MAIN_ADMIN_PASS ?? "admin123";

async function main() {
  const existing = await prisma.user.findFirst({
    where: { role: "MAIN_ADMIN" },
  });

  if (existing) {
    console.log("MAIN_ADMIN already exists:", existing.username);
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: "MAIN_ADMIN",
    },
  });

  console.log("MAIN_ADMIN created:", username);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
