import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getMusicSetting } from "@/lib/music-settings";
import Link from "next/link";
import {
  SONG_SUGGESTION_BLOCK_REASON_OPTIONS,
  findSongSuggestionBlockReasons,
  formatSongSuggestionBlockReasonLabel,
  normalizeSongSuggestionBlockReason,
} from "@/lib/song-suggestion-blocks";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SongsFilter = "all" | "clean" | "explicit";
type AdminTrack = {
  trackId: string;
  artist: string;
  title: string;
  year: number | null;
  yandexUrl: string;
  coverUrl?: string | null;
  explicit?: boolean;
  contentWarning?: string | null;
};

const normalizeSongsFilter = (value?: string): SongsFilter => {
  if (value === "clean" || value === "explicit") return value;
  return "all";
};

const normalizeSearchValue = (value?: string) => value?.trim() ?? "";

const buildSongsAdminHref = ({
  filter,
  blockedQuery,
  trackSearch,
}: {
  filter?: SongsFilter;
  blockedQuery?: string;
  trackSearch?: string;
}) => {
  const params = new URLSearchParams();
  if (filter && filter !== "all") params.set("filter", filter);
  if (blockedQuery) params.set("blockedQuery", blockedQuery);
  if (trackSearch) params.set("trackSearch", trackSearch);
  const query = params.toString();
  return query ? `/adm/songs?${query}` : "/adm/songs";
};

const searchTracksForStoplist = async (query: string) => {
  if (!query) {
    return {
      items: [] as AdminTrack[],
      error: null as string | null,
    };
  }

  const url = process.env.MUSIC_SERVICE_URL ?? "http://kiosk-music:3010";

  try {
    const res = await fetch(`${url}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        limit: 20,
        artist_limit: 0,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        items: [] as AdminTrack[],
        error: "Не удалось выполнить поиск по музыкальной базе.",
      };
    }
    const data = (await res.json()) as { tracks?: AdminTrack[] };
    return {
      items: Array.isArray(data.tracks) ? data.tracks : [],
      error: null as string | null,
    };
  } catch {
    return {
      items: [] as AdminTrack[],
      error: "Не удалось выполнить поиск по музыкальной базе.",
    };
  }
};

const deleteSuggestion = async (formData: FormData) => {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.songSuggestion.delete({ where: { id } });
  revalidatePath("/adm/songs");
};

const updateSettings = async (formData: FormData) => {
  "use server";
  await requireAdmin();
  const isEnabled = formData.get("isEnabled") === "on";
  const message = String(formData.get("disabledMessage") ?? "").trim();
  await prisma.musicSetting.upsert({
    where: { key: "main" },
    update: {
      isEnabled,
      disabledMessage: message || "Предложения временно отключены.",
    },
    create: {
      key: "main",
      isEnabled,
      disabledMessage: message || "Предложения временно отключены.",
    },
  });
  revalidatePath("/adm/songs");
};

const upsertSuggestionBlock = async (formData: FormData) => {
  "use server";
  await requireAdmin();
  const trackId = String(formData.get("trackId") ?? "").trim();
  if (!trackId) return;

  const artist = String(formData.get("artist") ?? "").trim() || null;
  const title = String(formData.get("title") ?? "").trim() || null;
  const reasonType = normalizeSongSuggestionBlockReason(
    String(formData.get("reasonType") ?? "")
  );
  const customReason = String(formData.get("reasonText") ?? "").trim();

  await prisma.songSuggestionBlock.upsert({
    where: { trackId },
    update: {
      artist,
      title,
      reasonType,
      reasonText: reasonType === "CUSTOM" ? customReason || null : null,
    },
    create: {
      trackId,
      artist,
      title,
      reasonType,
      reasonText: reasonType === "CUSTOM" ? customReason || null : null,
    },
  });
  revalidatePath("/adm/songs");
};

const deleteSuggestionBlock = async (formData: FormData) => {
  "use server";
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.songSuggestionBlock.delete({ where: { id } });
  revalidatePath("/adm/songs");
};

const formatBlockedTrackTitle = (artist?: string | null, title?: string | null) => {
  if (artist && title) return `${artist} — ${title}`;
  return artist || title || "Трек без названия";
};

export default async function SongsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    blockedQuery?: string;
    trackSearch?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const filter = normalizeSongsFilter(params.filter);
  const blockedQuery = normalizeSearchValue(params.blockedQuery);
  const trackSearch = normalizeSearchValue(params.trackSearch);
  const matchedReasonTypes = findSongSuggestionBlockReasons(blockedQuery);
  const settings = await getMusicSetting();
  const items = await prisma.songSuggestion.findMany({
    where:
      filter === "all"
        ? {}
        : {
            isExplicit: filter === "explicit",
          },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const blockedWhere = blockedQuery
    ? {
        OR: [
          { trackId: { contains: blockedQuery } },
          { artist: { contains: blockedQuery } },
          { title: { contains: blockedQuery } },
          { reasonText: { contains: blockedQuery } },
          ...(matchedReasonTypes.length > 0
            ? [{ reasonType: { in: matchedReasonTypes } }]
            : []),
        ],
      }
    : {};
  const blockedItems = await prisma.songSuggestionBlock.findMany({
    where: blockedWhere,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const trackSearchResult = await searchTracksForStoplist(trackSearch);
  const searchedTracks = trackSearchResult.items;
  const trackSearchError = trackSearchResult.error;
  const blockedLookupTrackIds = Array.from(
    new Set([
      ...items.map((item) => item.trackId),
      ...searchedTracks.map((item) => item.trackId),
    ])
  );
  const blockedLookupItems =
    blockedLookupTrackIds.length > 0
      ? await prisma.songSuggestionBlock.findMany({
          where: {
            trackId: {
              in: blockedLookupTrackIds,
            },
          },
        })
      : [];
  const blockedByTrackId = new Map(
    blockedLookupItems.map((item) => [item.trackId, item])
  );

  return (
    <div className="list">
      <div className="admin-card">
        <h1>Заявки на песни</h1>
        <p>Последние предложения для диджея.</p>
      </div>
      <div className="admin-card">
        <h2>Настройки предложки</h2>
        <form action={updateSettings} className="review-form">
          <label style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <input
              type="checkbox"
              name="isEnabled"
              defaultChecked={settings.isEnabled}
              className="switch-input"
            />
            <span className="switch" />
            Включить предложения
          </label>
          <textarea
            className="textarea"
            name="disabledMessage"
            defaultValue={settings.disabledMessage ?? ""}
            placeholder="Сообщение при отключении"
          />
          <button className="btn-primary" type="submit">
            Сохранить
          </button>
        </form>
      </div>
      <div className="admin-card">
        <h2>Стоп-лист</h2>
        <p>
          Здесь лежат запрещённые треки. Они остаются в поиске киоска, но заказать
          их нельзя. Кастомную причину лучше писать простыми словами: её увидят дети.
        </p>
        <form method="get" className="review-form">
          {filter !== "all" ? (
            <input type="hidden" name="filter" value={filter} />
          ) : null}
          {trackSearch ? (
            <input type="hidden" name="trackSearch" value={trackSearch} />
          ) : null}
          <input
            className="input"
            name="blockedQuery"
            defaultValue={blockedQuery}
            placeholder="Поиск по стоп-листу: песня, артист, причина, trackId"
          />
          <div className="admin-inline-actions">
            <button className="btn-ghost" type="submit">
              Найти в стоп-листе
            </button>
            {blockedQuery ? (
              <Link
                href={buildSongsAdminHref({ filter, trackSearch })}
                className="btn-ghost"
              >
                Сбросить поиск
              </Link>
            ) : null}
          </div>
        </form>
        <details className="admin-details" open={Boolean(trackSearch)}>
          <summary className="btn-primary admin-details-summary">
            Добавить в стоп-лист
          </summary>
          <div className="admin-details-body">
            <form method="get" className="review-form">
              {filter !== "all" ? (
                <input type="hidden" name="filter" value={filter} />
              ) : null}
              {blockedQuery ? (
                <input type="hidden" name="blockedQuery" value={blockedQuery} />
              ) : null}
              <input
                className="input"
                name="trackSearch"
                defaultValue={trackSearch}
                placeholder="Найти трек для блокировки"
              />
              <div className="admin-inline-actions">
                <button className="btn-ghost" type="submit">
                  Искать трек
                </button>
                {trackSearch ? (
                  <Link
                    href={buildSongsAdminHref({ filter, blockedQuery })}
                    className="btn-ghost"
                  >
                    Очистить поиск
                  </Link>
                ) : null}
              </div>
            </form>
            {trackSearchError ? (
              <div className="admin-song-block-note">{trackSearchError}</div>
            ) : null}
            {trackSearch ? (
              searchedTracks.length === 0 ? (
                <div className="admin-song-search-empty">
                  По этому запросу ничего не найдено.
                </div>
              ) : (
                <div className="admin-song-search-results">
                  {searchedTracks.map((track) => {
                    const blockedItem = blockedByTrackId.get(track.trackId);

                    return (
                      <div key={track.trackId} className="admin-song-search-card">
                        <div className="admin-suggestion-row">
                          {track.coverUrl ? (
                            <img
                              src={track.coverUrl}
                              alt=""
                              className="admin-suggestion-cover"
                            />
                          ) : null}
                          <div className="admin-suggestion-meta">
                            <div className="admin-suggestion-title-row">
                              <div className="admin-suggestion-title">
                                {track.artist} — {track.title}
                                {track.year ? ` (${track.year})` : ""}
                              </div>
                            </div>
                            <div className="admin-song-track-id">
                              Track ID: <code>{track.trackId}</code>
                            </div>
                            {blockedItem ? (
                              <div className="admin-song-block-note">
                                Уже в стоп-листе:{" "}
                                {formatSongSuggestionBlockReasonLabel(
                                  blockedItem.reasonType,
                                  blockedItem.reasonText
                                )}
                              </div>
                            ) : null}
                            <form action={upsertSuggestionBlock} className="review-form">
                              <input type="hidden" name="trackId" value={track.trackId} />
                              <input type="hidden" name="artist" value={track.artist} />
                              <input type="hidden" name="title" value={track.title} />
                              <select
                                className="input"
                                name="reasonType"
                                defaultValue={
                                  blockedItem?.reasonType ?? "EXPLICIT_LANGUAGE"
                                }
                              >
                                {SONG_SUGGESTION_BLOCK_REASON_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="input"
                                name="reasonText"
                                defaultValue={blockedItem?.reasonText ?? ""}
                                placeholder='Например: Эта песня сейчас не подходит для дискотеки'
                              />
                              <button className="btn-primary" type="submit">
                                {blockedItem ? "Обновить запрет" : "Заблокировать"}
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : null}
          </div>
        </details>
        <div className="admin-song-blocks">
          {blockedItems.length === 0 ? (
            <div>Пока нет запрещённых треков.</div>
          ) : (
            blockedItems.map((item) => (
              <div key={item.id} className="admin-song-block-row">
                <div className="admin-song-block-meta">
                  <div className="admin-song-block-title">
                    {formatBlockedTrackTitle(item.artist, item.title)}
                  </div>
                  <div className="admin-song-block-track">
                    Track ID: <code>{item.trackId}</code>
                  </div>
                  <div className="admin-song-block-reason">
                    Причина:{" "}
                    {formatSongSuggestionBlockReasonLabel(
                      item.reasonType,
                      item.reasonText
                    )}
                  </div>
                </div>
                <form action={deleteSuggestionBlock}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn-ghost" type="submit">
                    Снять запрет
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="admin-card">
        <h2>Фильтр</h2>
        <div className="admin-filters">
          <Link
            href={buildSongsAdminHref({ blockedQuery, trackSearch })}
            className={`pill admin-filter-link${filter === "all" ? " active" : ""}`}
          >
            Все
          </Link>
          <Link
            href={buildSongsAdminHref({
              filter: "clean",
              blockedQuery,
              trackSearch,
            })}
            className={`pill admin-filter-link${filter === "clean" ? " active" : ""}`}
          >
            Без E
          </Link>
          <Link
            href={buildSongsAdminHref({
              filter: "explicit",
              blockedQuery,
              trackSearch,
            })}
            className={`pill admin-filter-link${filter === "explicit" ? " active" : ""}`}
          >
            С E
          </Link>
        </div>
      </div>
      {items.length === 0 ? (
        <div>Пока нет заявок.</div>
      ) : (
        items.map((item) => {
          const blockedItem = blockedByTrackId.get(item.trackId);

          return (
            <div
              key={item.id}
              className="admin-card"
              style={{ padding: 16 }}
            >
              <div className="admin-suggestion-row">
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt=""
                    className="admin-suggestion-cover"
                  />
                ) : null}
                <div className="admin-suggestion-meta">
                  <div className="admin-suggestion-title-row">
                    <div className="admin-suggestion-title">
                      {item.artist} — {item.title}
                      {item.year ? ` (${item.year})` : ""}
                    </div>
                    {item.isExplicit ? (
                      <div className="pill music-explicit-pill">E</div>
                    ) : null}
                  </div>
                  <div style={{ color: "var(--ink-muted)", marginTop: 4 }}>
                    Запрос: {item.query}
                  </div>
                  <div className="admin-song-track-id">
                    Track ID: <code>{item.trackId}</code>
                  </div>
                  {blockedItem ? (
                    <div className="admin-song-block-note">
                      Запрещена к предложению:{" "}
                      {formatSongSuggestionBlockReasonLabel(
                        blockedItem.reasonType,
                        blockedItem.reasonText
                      )}
                    </div>
                  ) : null}
                  {item.isExplicit ? (
                    <div className="admin-explicit-note">
                      Возможно, песня не пройдет цензуру.
                    </div>
                  ) : null}
                  <a
                    href={item.yandexUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary"
                    style={{ display: "inline-block", marginTop: 8 }}
                  >
                    Открыть в Яндекс Музыке
                  </a>
                  <form
                    action={deleteSuggestion}
                    style={{ display: "inline-block", marginTop: 8, marginLeft: 8 }}
                  >
                    <input type="hidden" name="id" value={item.id} />
                    <button className="btn-ghost" type="submit">
                      Удалить
                    </button>
                  </form>
                  <details className="admin-inline-block-form">
                    <summary className="btn-ghost admin-details-summary">
                      {blockedItem ? "Изменить запрет" : "Заблокировать"}
                    </summary>
                    <form action={upsertSuggestionBlock} className="review-form admin-inline-block-body">
                      <input type="hidden" name="trackId" value={item.trackId} />
                      <input type="hidden" name="artist" value={item.artist} />
                      <input type="hidden" name="title" value={item.title} />
                      <select
                        className="input"
                        name="reasonType"
                        defaultValue={blockedItem?.reasonType ?? "EXPLICIT_LANGUAGE"}
                      >
                        {SONG_SUGGESTION_BLOCK_REASON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input"
                        name="reasonText"
                        defaultValue={blockedItem?.reasonText ?? ""}
                        placeholder='Например: Эта песня сейчас не подходит для дискотеки'
                      />
                      <button className="btn-primary" type="submit">
                        {blockedItem ? "Сохранить причину" : "Добавить в стоп-лист"}
                      </button>
                    </form>
                  </details>
                </div>
                <div className="admin-suggestion-date">
                  {item.createdAt.toLocaleString("ru-RU")}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
