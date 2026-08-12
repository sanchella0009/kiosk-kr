"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { broadcastRefresh } from "@/lib/broadcast";
import { getSessionUser } from "@/lib/auth";

async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Не авторизован");
  }
  return user;
}

// Squad Actions
export async function saveSquadAction(
  squadId: string | null,
  shiftId: string,
  name: string,
  photoUrl: string | null
) {
  await requireAuth();
  if (!name.trim()) return { success: false, error: "Название не может быть пустым" };

  try {
    if (squadId) {
      await prisma.squad.update({
        where: { id: squadId },
        data: { name: name.trim(), photoUrl },
      });
    } else {
      await prisma.squad.create({
        data: { name: name.trim(), photoUrl, shiftId },
      });
    }
    await broadcastRefresh();
    revalidatePath("/adm/squads");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при сохранении отряда" };
  }
}

export async function deleteSquadAction(squadId: string) {
  await requireAuth();
  try {
    await prisma.squad.delete({
      where: { id: squadId },
    });
    await broadcastRefresh();
    revalidatePath("/adm/squads");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при удалении отряда" };
  }
}

// Child Actions
export async function addChildAction(squadId: string, name: string) {
  await requireAuth();
  if (!name.trim()) return { success: false, error: "Имя ребенка не может быть пустым" };

  try {
    await prisma.child.create({
      data: { name: name.trim(), squadId },
    });
    await broadcastRefresh();
    revalidatePath("/adm/squads");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при добавлении ребенка" };
  }
}

export async function addChildrenBatchAction(squadId: string, namesText: string) {
  await requireAuth();
  const names = namesText
    .split("\n")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  if (names.length === 0) {
    return { success: false, error: "Список детей пуст" };
  }

  try {
    await prisma.child.createMany({
      data: names.map((name) => ({ name, squadId })),
    });
    await broadcastRefresh();
    revalidatePath("/adm/squads");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при массовом добавлении" };
  }
}

export async function toggleChildLeftAction(childId: string, isLeft: boolean) {
  await requireAuth();
  try {
    await prisma.child.update({
      where: { id: childId },
      data: { isLeft },
    });
    await broadcastRefresh();
    revalidatePath("/adm/squads");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при обновлении статуса" };
  }
}

export async function deleteChildAction(childId: string) {
  await requireAuth();
  try {
    await prisma.child.delete({
      where: { id: childId },
    });
    await broadcastRefresh();
    revalidatePath("/adm/squads");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при удалении ребенка" };
  }
}

// Best Child of the Day Actions
export async function setBestChildOfDayAction(
  squadId: string,
  childId: string | null,
  dateStr: string // YYYY-MM-DD
) {
  await requireAuth();
  const date = new Date(dateStr);

  try {
    // 1. Delete any existing best child marks for this squad's children on this date
    const squadChildren = await prisma.child.findMany({
      where: { squadId },
      select: { id: true },
    });
    const childIds = squadChildren.map((c) => c.id);

    await prisma.bestChildOfDay.deleteMany({
      where: {
        childId: { in: childIds },
        date,
      },
    });

    // 2. If a child was selected, set them as the best child
    if (childId) {
      await prisma.bestChildOfDay.create({
        data: {
          childId,
          date,
        },
      });
    }

    await broadcastRefresh();
    revalidatePath("/adm/squads");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при сохранении лучшего ребенка" };
  }
}

// Camp Logo Actions
export async function saveCampLogoAction(logoUrl: string) {
  await requireAuth();
  try {
    await prisma.campSetting.upsert({
      where: { key: "camp_logo" },
      update: { value: logoUrl },
      create: { key: "camp_logo", value: logoUrl },
    });
    await broadcastRefresh();
    revalidatePath("/adm/squads");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при сохранении логотипа" };
  }
}

export async function getCampLogoAction() {
  try {
    const setting = await prisma.campSetting.findUnique({
      where: { key: "camp_logo" },
    });
    return setting?.value || null;
  } catch {
    return null;
  }
}

// Event Actions (Ratings)
export async function saveEventAction(
  eventId: string | null,
  name: string,
  places: { squadId: string; place: number }[]
) {
  await requireAuth();
  if (!name.trim()) return { success: false, error: "Название мероприятия не может быть пустым" };

  try {
    if (eventId) {
      // Update Event Name
      await prisma.event.update({
        where: { id: eventId },
        data: { name: name.trim() },
      });

      // Update Places: we can delete existing places for this event and recreate them
      await prisma.eventPlace.deleteMany({
        where: { eventId },
      });

      if (places.length > 0) {
        await prisma.eventPlace.createMany({
          data: places.map((p) => ({
            eventId,
            squadId: p.squadId,
            place: p.place,
          })),
        });
      }
    } else {
      // Create Event
      const newEvent = await prisma.event.create({
        data: { name: name.trim() },
      });

      if (places.length > 0) {
        await prisma.eventPlace.createMany({
          data: places.map((p) => ({
            eventId: newEvent.id,
            squadId: p.squadId,
            place: p.place,
          })),
        });
      }
    }

    await broadcastRefresh();
    revalidatePath("/adm/ratings");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при сохранении мероприятия" };
  }
}

export async function deleteEventAction(eventId: string) {
  await requireAuth();
  try {
    await prisma.event.delete({
      where: { id: eventId },
    });
    await broadcastRefresh();
    revalidatePath("/adm/ratings");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при удалении мероприятия" };
  }
}

// Squad of the Day Actions
export async function setSquadOfDayAction(
  squadId: string,
  dateStr: string, // YYYY-MM-DD
  stars: number
) {
  await requireAuth();
  const date = new Date(dateStr);

  try {
    await prisma.squadOfDay.upsert({
      where: {
        squadId_date: {
          squadId,
          date,
        },
      },
      update: { stars },
      create: {
        squadId,
        date,
        stars,
      },
    });

    await broadcastRefresh();
    revalidatePath("/adm/ratings");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при выборе отряда дня" };
  }
}

export async function removeSquadOfDayAction(squadId: string, dateStr: string) {
  await requireAuth();
  const date = new Date(dateStr);

  try {
    await prisma.squadOfDay.delete({
      where: {
        squadId_date: {
          squadId,
          date,
        },
      },
    });

    await broadcastRefresh();
    revalidatePath("/adm/ratings");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при удалении отряда дня" };
  }
}

export async function updateSquadsOrderAction(squadIds: string[]) {
  await requireAuth();
  try {
    await prisma.$transaction(
      squadIds.map((id, index) =>
        prisma.squad.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );
    await broadcastRefresh();
    revalidatePath("/adm/squads");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Ошибка при изменении порядка" };
  }
}
