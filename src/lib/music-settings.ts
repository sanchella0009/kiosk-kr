import { prisma } from "@/lib/db";

const DEFAULT_DISABLED_MESSAGE = "Предложения временно отключены.";

export const getMusicSetting = async () => {
  const existing = await prisma.musicSetting.findUnique({
    where: { key: "main" },
  });
  if (existing) {
    return existing;
  }

  try {
    return await prisma.musicSetting.create({
      data: {
        key: "main",
        isEnabled: true,
        disabledMessage: DEFAULT_DISABLED_MESSAGE,
      },
    });
  } catch {
    const created = await prisma.musicSetting.findUnique({
      where: { key: "main" },
    });
    if (created) {
      return created;
    }
    throw new Error("Failed to initialize music settings");
  }
};
