"use client";

import { useEffect, useRef, useState } from "react";
import { ReviewForm } from "@/components/ReviewForm";
import { MediaPanel } from "@/components/MediaPanel";
import { formatDate } from "@/lib/date";
import { SongSuggestPanel } from "@/components/SongSuggestPanel";

type Section = {
  id: string;
  title: string;
  content: string | null;
};

type Review = {
  id: string;
  name: string | null;
  rating: number;
  message: string;
  createdAt: string | Date;
};

type WeatherDay = {
  date: string;
  tempMin: number | null;
  tempMax: number | null;
  icon?: string | null;
  condition?: string | null;
  code?: number | null;
};

type WeatherPayload = {
  location: string;
  now: {
    temp: number;
    feelsLike: number | null;
    icon?: string | null;
    condition?: string | null;
    code?: number | null;
  } | null;
  days: WeatherDay[];
  updatedAt: string;
};

type KioskData = {
  media: { id: string; type: "PHOTO" | "VIDEO"; url: string; title?: string | null }[];
  scheduleImages: { id: string; url: string; dateFor: string }[];
  menuImages: { id: string; url: string; dateFor: string }[];
  sections: Section[];
  reviews: Review[];
  activeShiftCounselors?: string | null;
  squads?: {
    id: string;
    name: string;
    photoUrl: string | null;
    children: {
      id: string;
      name: string;
      isLeft: boolean;
      bestDays: { date: string }[];
    }[];
  }[];
  events?: {
    id: string;
    name: string;
    places: { squadId: string; place: number }[];
  }[];
  squadOfDays?: {
    squadId: string;
    date: string;
    stars: number;
  }[];
  campLogo?: string | null;
  activeShift?: {
    id: string;
    title: string | null;
    startDate: string;
    endDate: string;
  } | null;
  serverTime: string;
};

type Props = {
  initialData: KioskData;
};

type Panel = "home" | "schedule" | "menu" | "review" | "section" | "music" | "counselors" | "squads" | "ratings";

const INACTIVITY_MS = 60_000;
const WEATHER_MIN = 5 * 60 * 1000;
const WEATHER_MAX = 8 * 60 * 1000;
const MEDIA_CACHE = "kiosk-cache-v4";

export function KioskClient({ initialData }: Props) {
  const [data, setData] = useState<KioskData>(initialData);
  const [panel, setPanel] = useState<Panel>("home");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(() => {
    if (initialData.squads && initialData.squads.length > 0) {
      return initialData.squads[0].id;
    }
    return null;
  });
  const [squadDetailView, setSquadDetailView] = useState(false);
  const [scheduleKey, setScheduleKey] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [showEarlierSchedule, setShowEarlierSchedule] = useState(false);
  const [showEarlierMenu, setShowEarlierMenu] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [showOnlineNotice, setShowOnlineNotice] = useState(false);
  const [weather, setWeather] = useState<WeatherPayload | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date(initialData.serverTime));
  const [musicModal, setMusicModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: "", message: "" });
  const [musicCountdown, setMusicCountdown] = useState(0);
  const lastActivityRef = useRef(Date.now());
  const wsRef = useRef<WebSocket | null>(null);
  const timeRowRef = useRef<HTMLDivElement | null>(null);

  const trackEvent = (type: "VISIT" | "CLICK", target: string) => {
    const kioskId = localStorage.getItem("kiosk_id");
    if (!kioskId) return;
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, target, kioskId }),
    }).catch((err) => console.warn("Analytics error:", err));
  };

  const setOnlineState = (next: boolean) => {
    setIsOnline((prev) => {
      if (!prev && next) {
        setShowOnlineNotice(true);
        window.setTimeout(() => setShowOnlineNotice(false), 3000);
      }
      return next;
    });
  };

  const refreshData = async () => {
    try {
      const res = await fetch(`/api/kiosk-data?ts=${Date.now()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("offline");
      const payload = (await res.json()) as KioskData;
      setData(payload);
      setSelectedSquadId((prev) => {
        if (prev) return prev;
        if (payload.squads && payload.squads.length > 0) {
          return payload.squads[0].id;
        }
        return null;
      });
      setNow(new Date(payload.serverTime));
      setOnlineState(true);
    } catch {
      setOnlineState(false);
    }
  };

  const onSelect = (next: Panel) => {
    lastActivityRef.current = Date.now();
    if (next !== "review") {
      setShowReviewForm(false);
    }
    if (next !== "schedule") {
      setShowEarlierSchedule(false);
    }
    if (next !== "menu") {
      setShowEarlierMenu(false);
    }
    if (isOnline) {
      refreshData();
    }
    if (next === "squads") {
      setSquadDetailView(false);
    }
    setPanel(next);
    if (next !== "home") {
      trackEvent("CLICK", next);
    }
  };

  const openMusicModal = (title: string, message: string) => {
    setMusicModal({ open: true, title, message });
    setMusicCountdown(15);
  };

  const closeMusicModal = () => {
    setMusicModal({ open: false, title: "", message: "" });
    setMusicCountdown(0);
  };

  const onMusicClick = async () => {
    lastActivityRef.current = Date.now();
    trackEvent("CLICK", "music");
    if (!isOnline) {
      openMusicModal("⚠️ данная функция не доступна", "Нет связи с сервером.");
      return;
    }
    try {
      const res = await fetch("/api/music/status", { cache: "no-store" });
      if (!res.ok) throw new Error("status failed");
      const data = (await res.json()) as { enabled: boolean; message?: string };
      if (!data.enabled) {
        openMusicModal(
          "⚠️ данная функция не доступна",
          data.message || "Предложения временно отключены."
        );
        return;
      }
      onSelect("music");
    } catch {
      openMusicModal(
        "⚠️ данная функция не доступна",
        "Сервис недоступен. Попробуйте позже."
      );
    }
  };

  const openSection = (id: string) => {
    lastActivityRef.current = Date.now();
    setSelectedSectionId(id);
    setPanel("section");
    const section = data.sections.find((s) => s.id === id);
    trackEvent("CLICK", `section:${section?.title || id}`);
  };

  useEffect(() => {
    // Generate or fetch kiosk ID on mount
    let kid = localStorage.getItem("kiosk_id");
    if (!kid) {
      kid = `Kiosk-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      localStorage.setItem("kiosk_id", kid);
    }
    // Track initial page load
    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "VISIT", target: "load", kioskId: kid }),
    }).catch((err) => console.warn(err));

    const touchOrPointer = () => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity > INACTIVITY_MS) {
        trackEvent("VISIT", "approach");
      }
      lastActivityRef.current = Date.now();
    };
    const onKey = () => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity > INACTIVITY_MS) {
        trackEvent("VISIT", "approach");
      }
      lastActivityRef.current = Date.now();
    };
    window.addEventListener("pointerdown", touchOrPointer);
    window.addEventListener("touchstart", touchOrPointer);
    window.addEventListener("keydown", onKey);
    const id = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current > INACTIVITY_MS) {
        setPanel("home");
      }
    }, 1000);
    return () => {
      window.removeEventListener("pointerdown", touchOrPointer);
      window.removeEventListener("touchstart", touchOrPointer);
      window.removeEventListener("keydown", onKey);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!musicModal.open) return;
    const id = window.setInterval(() => {
      setMusicCountdown((prev) => {
        if (prev <= 1) {
          closeMusicModal();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [musicModal.open]);

  const fitTimeText = () => {
    const row = timeRowRef.current;
    if (!row) return;
    const timeSpan = row.querySelector<HTMLElement>(".time-corner-time");
    if (!timeSpan) return;
    row.style.removeProperty("--time-font-override");
    if (row.scrollWidth <= row.clientWidth) return;
    const currentSize = Number.parseFloat(getComputedStyle(timeSpan).fontSize) || 20;
    const ratio = row.clientWidth / row.scrollWidth;
    const newSize = Math.max(14, Math.floor(currentSize * ratio));
    row.style.setProperty("--time-font-override", `${newSize}px`);
  };

  useEffect(() => {
    fitTimeText();
  }, [now, panel]);

  useEffect(() => {
    const onResize = () => fitTimeText();
    window.addEventListener("resize", onResize);
    const observer = new ResizeObserver(() => fitTimeText());
    if (timeRowRef.current) observer.observe(timeRowRef.current);
    return () => {
      window.removeEventListener("resize", onResize);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let timer: number | null = null;
    const cacheKey = "kiosk_weather_cache_v1";
    const countKey = "kiosk_weather_count_v1";

    const getCountState = () => {
      const today = new Date().toISOString().slice(0, 10);
      const raw = localStorage.getItem(countKey);
      if (!raw) return { date: today, count: 0 };
      try {
        const parsed = JSON.parse(raw) as { date: string; count: number };
        if (parsed.date !== today) return { date: today, count: 0 };
        return parsed;
      } catch {
        return { date: today, count: 0 };
      }
    };

    const setCountState = (count: number) => {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem(countKey, JSON.stringify({ date: today, count }));
    };

    const computeNextInterval = (count: number) => {
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 23 || hour < 6) {
        return 60 * 60 * 1000;
      }

      const DAILY_LIMIT = 450;
      const remaining = Math.max(DAILY_LIMIT - count, 1);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 0, 0, 0);
      const minutesLeft = Math.max(
        1,
        Math.floor((endOfDay.getTime() - now.getTime()) / 60000)
      );
      const intervalMs = Math.max(
        2 * 60 * 1000,
        Math.floor((minutesLeft / remaining) * 60 * 1000)
      );
      return intervalMs;
    };

    const fetchWeather = async () => {
      const state = getCountState();
      try {
        const res = await fetch(`/api/weather?ts=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("bad response");
        const payload = (await res.json()) as WeatherPayload;
        setWeather(payload);
        setWeatherError(null);
        localStorage.setItem(cacheKey, JSON.stringify(payload));
        setCountState(state.count + 1);
      } catch {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setWeather(JSON.parse(cached) as WeatherPayload);
        } else {
          setWeatherError("Погода временно недоступна");
        }
      } finally {
        const next = computeNextInterval(getCountState().count);
        timer = window.setTimeout(fetchWeather, next);
      }
    };

    fetchWeather();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const todayKey = now.toISOString().slice(0, 10);
  const scheduleKeys = data.scheduleImages
    .map((item) => item.dateFor.slice(0, 10))
    .sort();
  const menuKeys = data.menuImages
    .map((item) => item.dateFor.slice(0, 10))
    .sort();
  const scheduleEarlierKeys = scheduleKeys.filter((key) => key < todayKey);
  const scheduleUpcomingKeys = scheduleKeys.filter((key) => key >= todayKey);
  const menuEarlierKeys = menuKeys.filter((key) => key < todayKey);
  const menuUpcomingKeys = menuKeys.filter((key) => key >= todayKey);

  useEffect(() => {
    if (data.scheduleImages.length === 0) {
      setScheduleKey(null);
      return;
    }
    const list = showEarlierSchedule ? scheduleEarlierKeys : scheduleUpcomingKeys;
    if (scheduleKey && list.includes(scheduleKey)) return;
    if (showEarlierSchedule) {
      setScheduleKey(
        scheduleEarlierKeys[scheduleEarlierKeys.length - 1] ?? null
      );
    } else {
      setScheduleKey(scheduleUpcomingKeys[0] ?? null);
    }
  }, [
    data.scheduleImages,
    scheduleKey,
    now,
    showEarlierSchedule,
    scheduleEarlierKeys,
    scheduleUpcomingKeys,
  ]);

  useEffect(() => {
    if (data.menuImages.length === 0) {
      setMenuKey(null);
      return;
    }
    const list = showEarlierMenu ? menuEarlierKeys : menuUpcomingKeys;
    if (menuKey && list.includes(menuKey)) return;
    if (showEarlierMenu) {
      setMenuKey(menuEarlierKeys[menuEarlierKeys.length - 1] ?? null);
    } else {
      setMenuKey(menuUpcomingKeys[0] ?? null);
    }
  }, [
    data.menuImages,
    menuKey,
    now,
    showEarlierMenu,
    menuEarlierKeys,
    menuUpcomingKeys,
  ]);

  useEffect(() => {
    if (!("caches" in window) || !isOnline) return;
    const urls = new Set<string>();
    const photos = data.media.filter((item) => item.type === "PHOTO");
    const videos = data.media.filter((item) => item.type === "VIDEO");
    photos.forEach((item) => urls.add(item.url));
    videos.forEach((item) => urls.add(item.url));
    data.scheduleImages.forEach((item) => urls.add(item.url));
    data.menuImages.forEach((item) => urls.add(item.url));
    const list = Array.from(urls).filter((url) => url.startsWith("/"));
    if (list.length === 0) return;
    caches
      .open(MEDIA_CACHE)
      .then((cache) =>
        list.reduce(
          (chain, url) =>
            chain.then(() =>
              cache.match(url).then((hit) => {
                if (!hit) return cache.add(url);
              })
            ),
          Promise.resolve()
        )
      )
      .catch(() => null);
  }, [data.media, data.scheduleImages, data.menuImages, isOnline]);

  useEffect(() => {
    const url =
      process.env.NEXT_PUBLIC_WS_URL ||
      `${window.location.protocol === "https:" ? "wss" : "ws"}://${
        window.location.host
      }/ws/`;
    const connect = () => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onopen = () => setOnlineState(true);
        ws.onmessage = (event) => {
          if (event.data === "refresh") {
            refreshData();
          }
        };
        ws.onclose = () => {
          setTimeout(connect, 3000);
        };
      } catch {
        setTimeout(connect, 5000);
      }
    };
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    let active = true;
    const ping = async () => {
      try {
        const res = await fetch(`/api/health?ts=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("offline");
        if (active) setOnlineState(true);
      } catch {
        if (active) setOnlineState(false);
      }
    };
    ping();
    const id = window.setInterval(ping, 10000);
    const onOnline = () => setOnlineState(true);
    const onOffline = () => setOnlineState(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      active = false;
      window.clearInterval(id);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  let counselorsList: { id: string; name: string; photoUrl: string | null; category?: string; position?: string }[] = [];
  if (data.activeShiftCounselors) {
    try {
      counselorsList = JSON.parse(data.activeShiftCounselors);
    } catch {
      // ignore
    }
  }
  const hasCounselors = Array.isArray(counselorsList) && counselorsList.length > 0 && counselorsList.some(c => c.name?.trim() !== "");

  const hasSquads = Array.isArray(data.squads) && data.squads.length > 0;

  const getShiftDates = () => {
    if (!data.activeShift) return [];
    const dates: Date[] = [];
    const current = new Date(data.activeShift.startDate);
    const end = new Date(data.activeShift.endDate);
    current.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const shiftDates = getShiftDates();

  const formatDayMonth = (d: Date) => d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

  const getSquadPoints = (squadId: string) => {
    let total = 0;
    data.events?.forEach((evt) => {
      const placeRecord = evt.places.find((p) => p.squadId === squadId);
      if (placeRecord) {
        if (placeRecord.place === 1) total += 3;
        else if (placeRecord.place === 2) total += 2;
        else if (placeRecord.place === 3) total += 1;
      }
    });
    return total;
  };

  const selectedSquad = data.squads?.find((s) => s.id === selectedSquadId) || (data.squads && data.squads.length > 0 ? data.squads[0] : null);

  const groupedCounselors: { [category: string]: typeof counselorsList } = {};
  if (hasCounselors) {
    counselorsList.forEach((c) => {
      const cat = c.category?.trim() || "Вожатые";
      if (!groupedCounselors[cat]) {
        groupedCounselors[cat] = [];
      }
      groupedCounselors[cat].push(c);
    });
  }

  const sortedCategories = Object.keys(groupedCounselors).sort((a, b) => {
    if (a === "Администрация") return -1;
    if (b === "Администрация") return 1;
    return a.localeCompare(b, "ru-RU");
  });

  const locationName = weather?.location ?? "Красная Горка";
  const todayLabel = formatDate(now);
  const formatShortDate = (iso: string) =>
    new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
    }).format(new Date(iso));

  return (
    <main className="page">
      <MediaPanel items={data.media} />
      <section className="kiosk-right">
        <div className="kiosk-scroll" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {panel === "home" ? (
            <>
              <div className="hero card">
                <h1>Добро пожаловать в Красную Горку!</h1>
              </div>
              <div className="weather-widget card" style={{ marginTop: 0 }}>
                <div className="weather-header">
                  <div>
                    <strong>Погода</strong>
                    <div className="weather-sub">{locationName}</div>
                  </div>
                  {weather?.now?.icon ? (
                    <div className="weather-icon" aria-hidden>
                      {weather.now.icon}
                    </div>
                  ) : null}
                </div>
                {weather?.now ? (
                  <div className="weather-now">
                    <div className="weather-temp">{weather.now.temp}°</div>
                    <div className="weather-meta">
                      Ощущается {weather.now.feelsLike ?? weather.now.temp}°
                    </div>
                  </div>
                ) : (
                  <div className="weather-meta">
                    {weatherError ?? "Загрузка погоды..."}
                  </div>
                )}
                {weather?.now?.condition ? (
                  <div className="weather-meta">{weather.now.condition}</div>
                ) : null}
                {weather?.updatedAt ? (
                  <div className="weather-sub">
                    Обновлено {new Date(weather.updatedAt).toLocaleTimeString("ru-RU")}
                  </div>
                ) : null}
                <div className="weather-days">
                  {weather?.days?.slice(0, 3).map((day) => (
                    <div key={day.date} className="weather-day">
                      <div>
                        {day.icon ? <span>{day.icon} </span> : null}
                        {day.date}
                      </div>
                      <div>
                        {day.tempMax ?? "—"}° / {day.tempMin ?? "—"}°
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {panel === "home" ? (
            <div className="nav-grid">
            <button className="nav-btn" onClick={() => onSelect("schedule")}>
              📅 Расписание
            </button>
            <button className="nav-btn" onClick={() => onSelect("menu")}>
              🍲 Меню
            </button>
            <button className="nav-btn" onClick={() => onSelect("review")}>
              ⭐ Отзывы
            </button>
            <button className="nav-btn" onClick={onMusicClick}>
              🎵 Предложить песню
            </button>
             {hasCounselors ? (
              <button className="nav-btn" onClick={() => onSelect("counselors")}>
                👥 Сотрудники смены
              </button>
            ) : null}
            {hasSquads ? (
              <>
                <button className="nav-btn" onClick={() => onSelect("squads")}>
                  👥 Отряды
                </button>
                <button className="nav-btn" onClick={() => onSelect("ratings")}>
                  🏆 Рейтинг отрядов
                </button>
              </>
            ) : null}
            {data.sections.map((section) => (
              <button
                key={section.id}
                  className="nav-btn"
                  onClick={() => openSection(section.id)}
                >
                  ℹ️ {section.title}
                </button>
              ))}
            </div>
          ) : (
            <button className="btn-ghost btn-back" onClick={() => onSelect("home")}>
              ← Назад
            </button>
          )}

          {panel !== "home" ? (
            <div className="section-block card panel">
            {panel === "schedule" && (
              <>
                <h2>Расписание</h2>
                {data.scheduleImages.length === 0 ? (
                  <div>Расписание пока не загружено.</div>
                ) : (
                  <>
                    <div className="date-tabs">
                      {scheduleEarlierKeys.length > 0 ? (
                        <button
                          type="button"
                          className={`date-tab ${
                            showEarlierSchedule ? "active" : ""
                          }`}
                          onClick={() =>
                            setShowEarlierSchedule((prev) => !prev)
                          }
                        >
                          {showEarlierSchedule ? "Сегодня" : "Ранее"}
                        </button>
                      ) : null}
                      {(showEarlierSchedule
                        ? scheduleEarlierKeys
                        : scheduleUpcomingKeys
                      ).map((key) => {
                        const item = data.scheduleImages.find(
                          (entry) => entry.dateFor.slice(0, 10) === key
                        );
                        if (!item) return null;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`date-tab ${
                              scheduleKey === key ? "active" : ""
                            }`}
                            onClick={() => setScheduleKey(key)}
                          >
                            {formatShortDate(item.dateFor)}
                          </button>
                        );
                      })}
                    </div>
                    {scheduleKey ? (
                      <img
                        src={
                          data.scheduleImages.find(
                            (item) => item.dateFor.slice(0, 10) === scheduleKey
                          )?.url ?? ""
                        }
                        alt="Расписание"
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          border: "2px solid #f3d6a0",
                        }}
                      />
                    ) : null}
                  </>
                )}
              </>
            )}

            {panel === "menu" && (
              <>
                <h2>Меню</h2>
                {data.menuImages.length === 0 ? (
                  <div>Меню пока не загружено.</div>
                ) : (
                  <>
                    <div className="date-tabs">
                      {menuEarlierKeys.length > 0 ? (
                        <button
                          type="button"
                          className={`date-tab ${showEarlierMenu ? "active" : ""}`}
                          onClick={() => setShowEarlierMenu((prev) => !prev)}
                        >
                          {showEarlierMenu ? "Сегодня" : "Ранее"}
                        </button>
                      ) : null}
                      {(showEarlierMenu ? menuEarlierKeys : menuUpcomingKeys).map(
                        (key) => {
                          const item = data.menuImages.find(
                            (entry) => entry.dateFor.slice(0, 10) === key
                          );
                          if (!item) return null;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`date-tab ${
                                menuKey === key ? "active" : ""
                              }`}
                              onClick={() => setMenuKey(key)}
                            >
                              {formatShortDate(item.dateFor)}
                            </button>
                          );
                        }
                      )}
                    </div>
                    {menuKey ? (
                      <img
                        src={
                          data.menuImages.find(
                            (item) => item.dateFor.slice(0, 10) === menuKey
                          )?.url ?? ""
                        }
                        alt="Меню"
                        style={{
                          width: "100%",
                          borderRadius: 12,
                          border: "2px solid #f3d6a0",
                        }}
                      />
                    ) : null}
                  </>
                )}
              </>
            )}

            {panel === "section" && (
              <>
                {selectedSectionId ? (
                  (() => {
                    const section = data.sections.find(
                      (item) => item.id === selectedSectionId
                    );
                    if (!section) {
                      return <div>Раздел не найден.</div>;
                    }
                    return (
                      <>
                        <h2>{section.title}</h2>
                        <div
                          className="editor-view"
                          dangerouslySetInnerHTML={{
                            __html: section.content ?? "",
                          }}
                        />
                      </>
                    );
                  })()
                ) : (
                  <div>Выберите раздел.</div>
                )}
              </>
            )}

            {panel === "review" && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <h2>Отзывы о лагере</h2>
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={() => setShowReviewForm((prev) => !prev)}
                  >
                    {showReviewForm ? "Скрыть форму" : "Оставить отзыв"}
                  </button>
                </div>
                {showReviewForm ? (
                  <ReviewForm campName="лагере" />
                ) : (
                  <div className="list">
                    {data.reviews.length === 0 && <div>Пока нет отзывов.</div>}
                    {data.reviews.map((review) => (
                      <div key={review.id} className="card" style={{ padding: 14 }}>
                        <div>
                          {"★".repeat(review.rating)}{" "}
                          <strong>{review.name || "Гость"}</strong>
                        </div>
                        <div style={{ marginTop: 6 }}>{review.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {panel === "music" && (
              <>
                <h2>Предложить песню диджею</h2>
                <SongSuggestPanel />
              </>
            )}

            {panel === "counselors" && (
              <>
                <h2>Сотрудники смены</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 16 }}>
                  {sortedCategories.map((category) => (
                    <div key={category} className="counselor-group">
                      <h3 style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: "var(--accent)",
                        borderBottom: "2px solid var(--bg-deep)",
                        paddingBottom: 6,
                        marginBottom: 16
                      }}>
                        {category}
                      </h3>
                      <div className="counselors-grid" style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                        gap: 16
                      }}>
                        {groupedCounselors[category].map((counselor) => (
                          <div key={counselor.id} className="card counselor-card" style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            padding: 16,
                            textAlign: "center"
                          }}>
                            <div className="counselor-photo-wrapper" style={{
                              width: 120,
                              height: 120,
                              borderRadius: "50%",
                              overflow: "hidden",
                              backgroundColor: "var(--bg-deep)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "3px solid #f3d6a0",
                              marginBottom: 12
                            }}>
                              {counselor.photoUrl ? (
                                <img
                                  src={counselor.photoUrl}
                                  alt={counselor.name}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover"
                                  }}
                                />
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="var(--ink-muted)" strokeWidth="1.5" style={{ width: 50, height: 50 }}>
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                  <circle cx="12" cy="7" r="4" />
                                </svg>
                              )}
                            </div>
                            <div className="counselor-name" style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: "var(--ink)",
                              lineHeight: "1.3",
                              wordBreak: "break-word"
                            }}>
                              {counselor.name}
                            </div>
                            {counselor.position && (
                              <div className="counselor-position" style={{
                                fontSize: 13,
                                color: "var(--ink-muted)",
                                marginTop: 4,
                                lineHeight: "1.2",
                                wordBreak: "break-word"
                              }}>
                                {counselor.position}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {panel === "squads" && (
              <>
                {!squadDetailView ? (
                  <>
                    <h2>Отряды смены</h2>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: 20,
                      marginTop: 20
                    }}>
                      {data.squads?.map((squad) => {
                        const squadOfDayCount = data.squadOfDays?.filter((sod) => sod.squadId === squad.id).length || 0;

                        return (
                          <div
                            key={squad.id}
                            onClick={() => {
                              setSelectedSquadId(squad.id);
                              setSquadDetailView(true);
                            }}
                            style={{
                              position: "relative",
                              height: 200,
                              borderRadius: 16,
                              overflow: "hidden",
                              cursor: "pointer",
                              boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
                              border: "2px solid #f3d6a0",
                              backgroundImage: squad.photoUrl ? `url(${squad.photoUrl})` : "linear-gradient(135deg, #fcecd6 0%, #f3d6a0 100%)",
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              padding: 16,
                              transition: "transform 0.2s"
                            }}
                            className="squad-tile"
                          >
                            {squad.photoUrl && (
                              <div style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.7) 100%)",
                                zIndex: 1
                              }} />
                            )}

                            <div style={{
                              position: "relative",
                              zIndex: 2,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              width: "100%"
                            }}>
                              <h3 style={{
                                margin: 0,
                                color: squad.photoUrl ? "#fff" : "var(--ink)",
                                fontSize: 20,
                                fontWeight: 700,
                                textShadow: squad.photoUrl ? "1px 1px 3px rgba(0,0,0,0.8)" : "none",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-start",
                                gap: 4
                              }}>
                                <span>{squad.name}</span>
                                {squadOfDayCount > 0 && (
                                  <span style={{ fontSize: 16, color: "#ffc107", textShadow: "none" }}>
                                    {"⭐".repeat(squadOfDayCount)}
                                  </span>
                                )}
                              </h3>
                              <span style={{
                                background: "var(--accent-2)",
                                color: "#fff",
                                padding: "4px 10px",
                                borderRadius: 8,
                                fontSize: 14,
                                fontWeight: 800,
                                boxShadow: "0 2px 6px rgba(0,0,0,0.15)"
                              }}>
                                {getSquadPoints(squad.id)} б.
                              </span>
                            </div>
                            <div style={{
                              position: "relative",
                              zIndex: 2,
                              color: squad.photoUrl ? "#eee" : "var(--ink-muted)",
                              fontSize: 14,
                              fontWeight: 600,
                              textShadow: squad.photoUrl ? "1px 1px 2px rgba(0,0,0,0.8)" : "none"
                            }}>
                              Детей: {squad.children.length}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                      <button className="btn-ghost" onClick={() => setSquadDetailView(false)}>
                        ← К списку отрядов
                      </button>
                      <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                        <span>{selectedSquad ? selectedSquad.name : ""}</span>
                        {selectedSquad && (data.squadOfDays?.filter((sod) => sod.squadId === selectedSquad.id).length || 0) > 0 && (
                          <span style={{ fontSize: 20, color: "#ffc107" }}>
                            {"⭐".repeat(data.squadOfDays!.filter((sod) => sod.squadId === selectedSquad.id).length)}
                          </span>
                        )}
                      </h2>
                    </div>

                    {selectedSquad ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                        <div className="kiosk-media card" style={{
                          height: 400,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          background: "#000",
                          borderRadius: 16,
                          border: "3px solid #f3d6a0"
                        }}>
                          {selectedSquad.photoUrl ? (
                            <img
                              src={selectedSquad.photoUrl}
                              alt={selectedSquad.name}
                              style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                          ) : (
                            <div style={{ color: "#fff", fontStyle: "italic" }}>Фото отряда не загружено</div>
                          )}
                        </div>

                        <div style={{ overflowX: "auto", border: "1px solid #f3d6a0", borderRadius: 12, background: "#fff" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
                            <thead>
                              <tr style={{ background: "var(--bg-deep)", borderBottom: "2px solid #f3d6a0" }}>
                                <th style={{ padding: "14px 16px", textAlign: "left", minWidth: 200, position: "sticky", left: 0, background: "var(--bg-deep)", zIndex: 10, borderRight: "1px solid #f3d6a0" }}>Ребенок</th>
                                {shiftDates.map((d) => (
                                  <th key={d.toISOString()} style={{ padding: "14px 10px", minWidth: 70, fontWeight: 700 }}>
                                    {formatDayMonth(d)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {selectedSquad.children.map((child) => (
                                <tr key={child.id} style={{ borderBottom: "1px solid #f9ebd2", opacity: child.isLeft ? 0.4 : 1 }}>
                                  <td style={{
                                    padding: "14px 16px",
                                    textAlign: "left",
                                    fontWeight: 600,
                                    position: "sticky",
                                    left: 0,
                                    background: "#fff",
                                    borderRight: "1px solid #f3d6a0",
                                    textDecoration: child.isLeft ? "line-through" : "none"
                                  }}>
                                    {child.name} {child.isLeft && <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 400 }}>(выбыл)</span>}
                                  </td>
                                  {shiftDates.map((date) => {
                                    const dateKey = date.toISOString().slice(0, 10);
                                    const isBest = child.bestDays.some(
                                      (b) => new Date(b.date).toISOString().slice(0, 10) === dateKey
                                    );
                                    return (
                                      <td key={date.toISOString()} style={{ padding: 8 }}>
                                        {isBest && data.campLogo ? (
                                          <img
                                            src={data.campLogo}
                                            alt="Лого"
                                            style={{ width: 36, height: 36, objectFit: "contain", margin: "0 auto" }}
                                          />
                                        ) : isBest ? (
                                          <span style={{ fontSize: 24 }}>⭐</span>
                                        ) : null}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                              {selectedSquad.children.length === 0 && (
                                <tr>
                                  <td colSpan={shiftDates.length + 1} style={{ padding: 24, color: "var(--ink-muted)", fontStyle: "italic" }}>
                                    В этом отряде пока нет детей.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: "var(--ink-muted)", fontStyle: "italic" }}>Отряды не созданы</div>
                    )}
                  </>
                )}
              </>
            )}

            {panel === "ratings" && (
              <>
                <h2>Рейтинг отрядов</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 30, marginTop: 16 }}>
                  {/* Event Rankings Table */}
                  <div style={{ overflowX: "auto", border: "1px solid #f3d6a0", borderRadius: 12, background: "#fff" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
                      <thead>
                        <tr style={{ background: "var(--bg-deep)", borderBottom: "2px solid #f3d6a0" }}>
                          <th style={{ padding: "14px 16px", textAlign: "left", minWidth: 220, borderRight: "1px solid #f3d6a0" }}>Мероприятие</th>
                          {data.squads?.map((s) => (
                            <th key={s.id} style={{ padding: "14px 16px", minWidth: 120 }}>{s.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.events?.map((evt) => (
                          <tr key={evt.id} style={{ borderBottom: "1px solid #f9ebd2" }}>
                            <td style={{ padding: "14px 16px", textAlign: "left", fontWeight: 600, borderRight: "1px solid #f9ebd2" }}>{evt.name}</td>
                            {data.squads?.map((squad) => {
                              const placeRecord = evt.places.find((p) => p.squadId === squad.id);
                              if (!placeRecord) return <td key={squad.id} style={{ padding: 14 }}>—</td>;
                              if (placeRecord.place === 1) return <td key={squad.id} style={{ padding: 14, fontWeight: 700, color: "#c9920c" }}>🥇 1 место (3 б.)</td>;
                              if (placeRecord.place === 2) return <td key={squad.id} style={{ padding: 14, fontWeight: 700, color: "#7a8b99" }}>🥈 2 место (2 б.)</td>;
                              if (placeRecord.place === 3) return <td key={squad.id} style={{ padding: 14, fontWeight: 700, color: "#8d5b4c" }}>🥉 3 место (1 б.)</td>;
                              return <td key={squad.id} style={{ padding: 14 }}>{placeRecord.place} место</td>;
                            })}
                          </tr>
                        ))}
                        {(!data.events || data.events.length === 0) && (
                          <tr>
                            <td colSpan={(data.squads?.length || 0) + 1} style={{ padding: 24, color: "var(--ink-muted)", fontStyle: "italic" }}>
                              Мероприятия не проводились
                            </td>
                          </tr>
                        )}
                        {/* Total Points Row */}
                        <tr style={{ background: "var(--bg-deep)", borderTop: "2px solid #f3d6a0", fontWeight: 800 }}>
                          <td style={{ padding: "16px 16px", textAlign: "left", fontSize: 16, borderRight: "1px solid #f3d6a0" }}>Итого баллов</td>
                          {data.squads?.map((s) => (
                            <td key={s.id} style={{ padding: "16px 16px", fontSize: 16, color: "var(--accent-2)" }}>{getSquadPoints(s.id)}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Squads of the Day Section */}
                  <div>
                    <h3 style={{ fontSize: 22, fontWeight: 700, color: "var(--accent)", borderBottom: "2px solid var(--bg-deep)", paddingBottom: 8, marginBottom: 20 }}>
                      ⭐ Отряды дня
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
                      {shiftDates.map((date) => {
                        const dateKey = date.toISOString().slice(0, 10);
                        const activeSods = data.squadOfDays?.filter((sod) =>
                          new Date(sod.date).toISOString().slice(0, 10) === dateKey
                        ) || [];
                        const formattedDate = date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

                        return (
                          <div key={dateKey} className="card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 120 }}>
                            <div style={{ fontWeight: 700, color: "var(--accent)", borderBottom: "1px solid #f9ebd2", paddingBottom: 6 }}>
                              📅 {formattedDate}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, justifyContent: "center" }}>
                              {activeSods.length === 0 ? (
                                <div style={{ color: "var(--ink-muted)", fontStyle: "italic", fontSize: 13 }}>Не назначен</div>
                              ) : (
                                activeSods.map((sod) => {
                                  const sq = data.squads?.find((s) => s.id === sod.squadId);
                                  if (!sq) return null;
                                  return (
                                    <div key={sod.squadId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                      <span style={{ fontWeight: 600, fontSize: 14 }}>{sq.name}</span>
                                      <span style={{ fontSize: 16, color: "#ffc107" }}>⭐</span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
        </div>

        <div className="kiosk-dock">
          {!isOnline ? (
            <div className="offline-bar">Нет связи с сервером</div>
          ) : showOnlineNotice ? (
            <div className="offline-bar online">Подключение восстановлено</div>
          ) : null}
          {panel === "home" ? (
            <div className="time-dock">
              <div className="time-corner">
                <div className="time-corner-row" ref={timeRowRef}>
                  <span className="time-corner-time" suppressHydrationWarning>
                    {now.toLocaleTimeString("ru-RU")}
                  </span>
                  <span className="time-corner-date" suppressHydrationWarning>
                    {now.toLocaleDateString("ru-RU")}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
      {musicModal.open ? (
        <div className="kiosk-modal">
          <div className="kiosk-modal-card">
            <div className="kiosk-modal-title">{musicModal.title}</div>
            <div className="kiosk-modal-text">{musicModal.message}</div>
            <button className="btn-primary" type="button" onClick={closeMusicModal}>
              Понятно ({musicCountdown})
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
