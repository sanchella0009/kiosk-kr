"use server";

import { prisma } from "@/lib/db";
import { saveBuffer, deleteUploadIfLocal } from "@/lib/media";
import { revalidatePath } from "next/cache";

type SyncResult = {
  success: boolean;
  message: string;
  count: number;
};

export async function syncVkMenuAction(): Promise<SyncResult> {
  const token = process.env.VK_SERVICE_TOKEN;
  const groupId = process.env.VK_GROUP_ID || "krgorka44";

  if (!token) {
    return {
      success: false,
      message: "Сервисный ключ VK не настроен в файле .env (переменная VK_SERVICE_TOKEN)",
      count: 0,
    };
  }

  try {
    // Fetch latest 20 posts from the VK group wall
    const vkApiUrl = `https://api.vk.com/method/wall.get?domain=${groupId}&count=20&access_token=${token}&v=5.131`;
    const response = await fetch(vkApiUrl);
    
    if (!response.ok) {
      return {
        success: false,
        message: `Ошибка запроса к API VK: ${response.statusText}`,
        count: 0,
      };
    }

    const data = await response.json();

    if (data.error) {
      return {
        success: false,
        message: `Ошибка VK API: ${data.error.error_msg} (код ${data.error.error_code})`,
        count: 0,
      };
    }

    const posts = data.response?.items || [];
    let importedCount = 0;
    let lastImportedDate = "";

    // Process posts from oldest to newest to ensure chronological order/overwrite
    const menuPosts = posts
      .filter((post: any) => {
        const text = (post.text || "").toLowerCase();
        // Look for keywords "меню" or "питание"
        return text.includes("меню") || text.includes("питание");
      })
      .reverse();

    for (const post of menuPosts) {
      // Find photo attachment
      const attachment = post.attachments?.find((att: any) => att.type === "photo");
      if (!attachment) continue;

      const sizes = attachment.photo.sizes || [];
      if (sizes.length === 0) continue;

      // Sort sizes descending by area (width * height) to find the highest resolution
      sizes.sort((a: any, b: any) => (b.width * b.height) - (a.width * a.height));
      const photoUrl = sizes[0].url;

      // Resolve date of the menu (post date at midnight)
      const postDate = new Date(post.date * 1000);
      postDate.setHours(0, 0, 0, 0);

      // Check if a menu for this date already exists in the database
      const existing = await prisma.media.findFirst({
        where: {
          category: "MENU",
          dateFor: postDate,
        },
      });

      // Download the photo buffer
      const photoResponse = await fetch(photoUrl);
      if (!photoResponse.ok) continue;

      const arrayBuffer = await photoResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileExt = photoUrl.split("?")[0].split(".").pop() || "jpg";
      const fileName = `vk-menu-${postDate.toISOString().split("T")[0]}.${fileExt}`;

      // Delete the old menu file and record if it exists to allow update
      if (existing) {
        await deleteUploadIfLocal(existing.url);
        await prisma.media.delete({
          where: { id: existing.id },
        });
      }

      // Save new buffer to disk and register in DB
      const urlPath = await saveBuffer(buffer, fileName);
      await prisma.media.create({
        data: {
          category: "MENU",
          type: "PHOTO",
          url: urlPath,
          dateFor: postDate,
          isActive: true,
        },
      });

      importedCount++;
      lastImportedDate = postDate.toLocaleDateString("ru-RU");
    }

    revalidatePath("/adm/media");
    revalidatePath("/");

    if (importedCount > 0) {
      return {
        success: true,
        message: `Успешно импортировано/обновлено меню (${importedCount} шт.). Последнее от ${lastImportedDate}`,
        count: importedCount,
      };
    } else {
      return {
        success: true,
        message: "Новых постов с меню во ВКонтакте не обнаружено (все актуальные меню уже импортированы)",
        count: 0,
      };
    }
  } catch (error: any) {
    console.error("VK Menu Sync error:", error);
    return {
      success: false,
      message: `Внутренняя ошибка синхронизации: ${error.message || error}`,
      count: 0,
    };
  }
}
