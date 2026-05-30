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
  tab,
  filter,
  blockedQuery,
  trackSearch,
}: {
  tab?: string;
  filter?: SongsFilter;
  blockedQuery?: string;
  trackSearch?: string;
}) => {
  const params = new URLSearchParams();
  if (tab && tab !== "suggestions") params.set("tab", tab);
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
    tab?: string;
    filter?: string;
    blockedQuery?: string;
    trackSearch?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const tab = params.tab === "stoplist" || params.tab === "settings" ? params.tab : "suggestions";
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
    <div className="list" style={{ gap: 20 }}>
      {/* Title Header Card */}
      <div className="admin-card">
        <h1>Заявки на песни</h1>
        <p style={{ color: "var(--ink-muted)", marginTop: 4 }}>
          Управление заказами треков с киоска и стоп-листом нежелательных песен для диджея.
        </p>
      </div>

      {/* Tabs navigation */}
      <div className="admin-tabs">
        <Link
          href={buildSongsAdminHref({ tab: "suggestions", filter, blockedQuery, trackSearch })}
          className={`admin-tab${tab === "suggestions" ? " active" : ""}`}
        >
          🎵 Заявки ({items.length})
        </Link>
        <Link
          href={buildSongsAdminHref({ tab: "stoplist", filter, blockedQuery, trackSearch })}
          className={`admin-tab${tab === "stoplist" ? " active" : ""}`}
        >
          🚫 Стоп-лист ({blockedItems.length})
        </Link>
        <Link
          href={buildSongsAdminHref({ tab: "settings", filter, blockedQuery, trackSearch })}
          className={`admin-tab${tab === "settings" ? " active" : ""}`}
        >
          ⚙️ Настройки
        </Link>
      </div>

      {/* Tab 1: Suggestions */}
      {tab === "suggestions" && (
        <>
          <div className="admin-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <h2>Список предложений от детей</h2>
              <div className="admin-filters">
                <Link
                  href={buildSongsAdminHref({ tab: "suggestions", filter: "all", blockedQuery, trackSearch })}
                  className={`pill admin-filter-link${filter === "all" ? " active" : ""}`}
                >
                  Все ({items.length})
                </Link>
                <Link
                  href={buildSongsAdminHref({ tab: "suggestions", filter: "clean", blockedQuery, trackSearch })}
                  className={`pill admin-filter-link${filter === "clean" ? " active" : ""}`}
                >
                  Без E
                </Link>
                <Link
                  href={buildSongsAdminHref({ tab: "suggestions", filter: "explicit", blockedQuery, trackSearch })}
                  className={`pill admin-filter-link${filter === "explicit" ? " active" : ""}`}
                >
                  С E (нецензурные)
                </Link>
              </div>
            </div>
          </div>

          <div className="list" style={{ gap: 16 }}>
            {items.length === 0 ? (
              <div className="admin-card" style={{ padding: 24, textAlign: "center", color: "var(--ink-muted)", fontStyle: "italic" }}>
                Заявок не найдено.
              </div>
            ) : (
              items.map((item) => {
                const blockedItem = blockedByTrackId.get(item.trackId);
                return (
                  <div key={item.id} className="admin-card" style={{ padding: 20, border: blockedItem ? "1px solid #ffcccc" : "1px solid #f3d6a0" }}>
                    <div className="admin-suggestion-row">
                      {item.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.coverUrl}
                          alt=""
                          className="admin-suggestion-cover"
                        />
                      ) : (
                        <div className="admin-suggestion-cover" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-deep)", fontSize: 24 }}>🎵</div>
                      )}
                      <div className="admin-suggestion-meta" style={{ flex: 1 }}>
                        <div className="admin-suggestion-title-row" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <div className="admin-suggestion-title" style={{ fontSize: 18, fontWeight: 700 }}>
                            {item.artist} — {item.title}
                            {item.year ? ` (${item.year})` : ""}
                          </div>
                          {item.isExplicit ? (
                            <div className="pill music-explicit-pill" style={{ background: "#ffccd5", color: "#c53030", fontWeight: 700, padding: "2px 8px", fontSize: 13, borderRadius: 6 }}>E</div>
                          ) : null}
                        </div>
                        <div style={{ color: "var(--ink-muted)", marginTop: 6, fontSize: 15 }}>
                          Запрос: <strong>«{item.query}»</strong>
                        </div>
                        <div className="admin-song-track-id" style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>
                          Track ID: <code>{item.trackId}</code>
                        </div>
                        {blockedItem && (
                          <div style={{ marginTop: 8, padding: "8px 12px", background: "#fff5f5", border: "1px solid #fed7d7", borderRadius: 10, color: "#c53030", fontSize: 14 }}>
                            🚫 <strong>В стоп-листе:</strong> {formatSongSuggestionBlockReasonLabel(
                              blockedItem.reasonType,
                              blockedItem.reasonText
                            )}
                          </div>
                        )}
                        {item.isExplicit && !blockedItem && (
                          <div style={{ marginTop: 8, color: "#c53030", fontSize: 13, fontWeight: 600 }}>
                            ⚠️ Внимание: Трек содержит нецензурную лексику!
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 16 }}>
                          <a
                            href={item.yandexUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-primary"
                            style={{ padding: "8px 14px", fontSize: 14 }}
                          >
                            Открыть на Яндекс Музыке
                          </a>
                          <form action={deleteSuggestion}>
                            <input type="hidden" name="id" value={item.id} />
                            <button className="btn-ghost" type="submit" style={{ borderColor: "#b1462b", color: "#b1462b", padding: "8px 14px", fontSize: 14 }}>
                              Удалить заявку
                            </button>
                          </form>
                          <details className="admin-inline-block-form">
                            <summary className="btn-ghost admin-details-summary" style={{ padding: "8px 14px", fontSize: 14 }}>
                              {blockedItem ? "Изменить запрет" : "Заблокировать песню"}
                            </summary>
                            <form action={upsertSuggestionBlock} className="review-form admin-inline-block-body" style={{ display: "grid", gap: 10, marginTop: 12 }}>
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
                                placeholder="Кастомное пояснение (увидит ребенок)"
                              />
                              <button className="btn-primary" type="submit">
                                {blockedItem ? "Сохранить причину" : "Добавить в стоп-лист"}
                              </button>
                            </form>
                          </details>
                        </div>
                      </div>
                      <div className="admin-suggestion-date" style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                        {item.createdAt.toLocaleString("ru-RU")}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Tab 2: Stoplist */}
      {tab === "stoplist" && (
        <>
          <div className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <h2>Управление стоп-листом</h2>
              <p style={{ color: "var(--ink-muted)", fontSize: 14, marginTop: 4 }}>
                Запрещенные песни по-прежнему будут находиться в поиске на киоске, но при попытке их предложить ребенок увидит причину запрета.
              </p>
            </div>

            {/* Search Stoplist */}
            <form method="get" className="review-form" style={{ marginTop: 8 }}>
              <input type="hidden" name="tab" value="stoplist" />
              {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
              {trackSearch ? <input type="hidden" name="trackSearch" value={trackSearch} /> : null}
              <div style={{ display: "flex", gap: 12 }}>
                <input
                  className="input"
                  name="blockedQuery"
                  defaultValue={blockedQuery}
                  placeholder="Поиск по стоп-листу: песня, артист, причина, trackId..."
                  style={{ flex: 1 }}
                />
                <button className="btn-primary" type="submit" style={{ padding: "10px 20px" }}>
                  Найти
                </button>
                {blockedQuery ? (
                  <Link
                    href={buildSongsAdminHref({ tab: "stoplist", filter, trackSearch })}
                    className="btn-ghost"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    Сбросить
                  </Link>
                ) : null}
              </div>
            </form>
          </div>

          {/* Add Track to Stoplist Section */}
          <div className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3>Добавить трек в стоп-лист</h3>
            <form method="get" className="review-form">
              <input type="hidden" name="tab" value="stoplist" />
              {blockedQuery ? <input type="hidden" name="blockedQuery" value={blockedQuery} /> : null}
              <div style={{ display: "flex", gap: 12 }}>
                <input
                  className="input"
                  name="trackSearch"
                  defaultValue={trackSearch}
                  placeholder="Поиск треков в Яндекс Музыке по названию/исполнителю..."
                  style={{ flex: 1 }}
                />
                <button className="btn-ghost" type="submit" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
                  Искать в Яндекс Музыке
                </button>
                {trackSearch ? (
                  <Link
                    href={buildSongsAdminHref({ tab: "stoplist", blockedQuery })}
                    className="btn-ghost"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    Очистить результаты
                  </Link>
                ) : null}
              </div>
            </form>

            {trackSearchError && (
              <div className="music-warning" style={{ padding: "10px 14px", background: "#fff0d9", color: "#7a4b1c", borderRadius: 12 }}>
                {trackSearchError}
              </div>
            )}

            {trackSearch && (
              searchedTracks.length === 0 ? (
                <div style={{ color: "var(--ink-muted)", fontStyle: "italic", padding: "8px 0" }}>
                  По запросу ничего не найдено в Яндекс Музыке.
                </div>
              ) : (
                <div className="list" style={{ display: "grid", gap: 16, marginTop: 12 }}>
                  {searchedTracks.map((track) => {
                    const blockedItem = blockedByTrackId.get(track.trackId);
                    return (
                      <div key={track.trackId} className="card" style={{ padding: 16, border: "1px solid #f3d6a0", background: "#fff" }}>
                        <div className="admin-suggestion-row">
                          {track.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={track.coverUrl} alt="" className="admin-suggestion-cover" />
                          ) : (
                            <div className="admin-suggestion-cover" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-deep)", fontSize: 20 }}>🎵</div>
                          )}
                          <div className="admin-suggestion-meta" style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>
                              {track.artist} — {track.title} {track.year ? `(${track.year})` : ""}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                              Track ID: <code>{track.trackId}</code>
                            </div>
                            {blockedItem && (
                              <div style={{ marginTop: 8, padding: "6px 12px", background: "#fff5f5", color: "#c53030", borderRadius: 10, fontSize: 13 }}>
                                🚫 Уже в стоп-листе: {formatSongSuggestionBlockReasonLabel(blockedItem.reasonType, blockedItem.reasonText)}
                              </div>
                            )}
                            <form action={upsertSuggestionBlock} className="review-form" style={{ marginTop: 12, display: "grid", gap: 8 }}>
                              <input type="hidden" name="trackId" value={track.trackId} />
                              <input type="hidden" name="artist" value={track.artist} />
                              <input type="hidden" name="title" value={track.title} />
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <select className="input" name="reasonType" defaultValue={blockedItem?.reasonType ?? "EXPLICIT_LANGUAGE"} style={{ width: 220 }}>
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
                                  placeholder="Кастомное пояснение (показывается ребенку)"
                                  style={{ flex: 1, minWidth: 200 }}
                                />
                              </div>
                              <button className="btn-primary" type="submit" style={{ alignSelf: "flex-start", padding: "8px 16px", fontSize: 14 }}>
                                {blockedItem ? "Обновить причину" : "Заблокировать трек"}
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* Blocked list items */}
          <div className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h3>Список запрещённых треков ({blockedItems.length})</h3>
            <div className="list" style={{ gap: 12 }}>
              {blockedItems.length === 0 ? (
                <div style={{ color: "var(--ink-muted)", fontStyle: "italic", padding: "8px 0" }}>
                  Стоп-лист пуст.
                </div>
              ) : (
                blockedItems.map((item) => (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      padding: 16,
                      background: "#fff",
                      border: "1px solid #f3d6a0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 16,
                      flexWrap: "wrap"
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{formatBlockedTrackTitle(item.artist, item.title)}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                        Track ID: <code>{item.trackId}</code>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600, marginTop: 4 }}>
                        Причина: {formatSongSuggestionBlockReasonLabel(item.reasonType, item.reasonText)}
                      </div>
                    </div>
                    <form action={deleteSuggestionBlock}>
                      <input type="hidden" name="id" value={item.id} />
                      <button className="btn-ghost" type="submit" style={{ borderColor: "#b1462b", color: "#b1462b", padding: "8px 12px", fontSize: 13 }}>
                        Разблокировать
                      </button>
                    </form>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Tab 3: Settings */}
      {tab === "settings" && (
        <div className="admin-card">
          <h2>Настройки модуля заказов песен</h2>
          <form action={updateSettings} className="review-form" style={{ marginTop: 16, display: "grid", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
              <input
                type="checkbox"
                name="isEnabled"
                defaultChecked={settings.isEnabled}
                className="switch-input"
              />
              <span className="switch" />
              Прием заявок с киоска включен
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-muted)" }}>
                Сообщение для детей, если предложка отключена:
              </label>
              <textarea
                className="textarea"
                name="disabledMessage"
                defaultValue={settings.disabledMessage ?? ""}
                placeholder="Например: Предложения песен временно отключены. Скоро дискотека!"
                style={{ width: "100%" }}
              />
            </div>
            <button className="btn-primary" type="submit" style={{ alignSelf: "flex-start", minWidth: 150 }}>
              Сохранить настройки
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
