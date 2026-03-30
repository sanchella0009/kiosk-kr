"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard } from "@/components/Keyboard";

type Track = {
  trackId: string;
  artist: string;
  title: string;
  year: number | null;
  yandexUrl: string;
  coverUrl?: string | null;
};

type Artist = {
  artistId: string;
  name: string;
  coverUrl?: string | null;
};

const TRACK_RESULT_LIMIT = 12;
const ARTIST_RESULT_LIMIT = 3;
const DUPLICATE_HINT_WINDOW_SECONDS = 15;

export function SongSuggestPanel() {
  const [query, setQuery] = useState("");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [searchTracks, setSearchTracks] = useState<Track[]>([]);
  const [results, setResults] = useState<Track[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [status, setStatus] = useState<
    | "idle"
    | "searching"
    | "search-error"
    | "submitting"
    | "submit-error"
    | "no-results"
    | "sent"
  >("idle");
  const [enabled, setEnabled] = useState(true);
  const [disabledMessage, setDisabledMessage] = useState(
    "Предложения временно отключены."
  );
  const [focused, setFocused] = useState(false);
  const [hasSearchedCurrentQuery, setHasSearchedCurrentQuery] = useState(false);
  const [pendingTrackLabel, setPendingTrackLabel] = useState("");
  const keyboardInteractRef = useRef(false);
  const blurTimeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const trimmedQuery = query.trim();
  const isBusy = status === "searching" || status === "submitting";

  const clearBlurTimeout = () => {
    if (blurTimeoutRef.current === null) return;
    window.clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = null;
  };

  const focusInput = () => {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  };

  const loadStatus = async () => {
    try {
      const res = await fetch("/api/music/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        enabled: boolean;
        message: string;
      };
      setEnabled(Boolean(data.enabled));
      if (data.message) setDisabledMessage(data.message);
    } catch {}
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => () => clearBlurTimeout(), []);

  const search = async () => {
    const q = trimmedQuery;
    if (!q) return;
    setHasSearchedCurrentQuery(true);
    setStatus("searching");
    setSelectedArtist(null);
    try {
      const res = await fetch("/api/music/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: q,
          limit: TRACK_RESULT_LIMIT,
          artistLimit: ARTIST_RESULT_LIMIT,
        }),
      });
      if (res.status === 403) {
        const data = (await res.json()) as { message?: string };
        if (data?.message) setDisabledMessage(data.message);
        setEnabled(false);
        setStatus("idle");
        return;
      }
      if (!res.ok) throw new Error("search failed");
      const data = (await res.json()) as {
        artists?: Artist[];
        tracks?: Track[];
      };
      const nextArtists = Array.isArray(data.artists) ? data.artists : [];
      const nextTracks = Array.isArray(data.tracks) ? data.tracks : [];
      setArtists(nextArtists);
      setSearchTracks(nextTracks);
      setResults(nextTracks);
      if (nextArtists.length === 0 && nextTracks.length === 0) {
        setStatus("no-results");
        return;
      }
      setStatus("idle");
    } catch {
      setStatus("search-error");
    }
  };

  const loadArtistTracks = async (artist: Artist) => {
    setSelectedArtist(artist);
    setStatus("searching");
    try {
      const res = await fetch("/api/music/artist-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId: artist.artistId, limit: TRACK_RESULT_LIMIT }),
      });
      if (res.status === 403) {
        const data = (await res.json()) as { message?: string };
        if (data?.message) setDisabledMessage(data.message);
        setEnabled(false);
        setStatus("idle");
        return;
      }
      if (!res.ok) throw new Error("artist search failed");
      const data = (await res.json()) as { items?: Track[] };
      const nextTracks = Array.isArray(data.items) ? data.items : [];
      setResults(nextTracks);
      if (nextTracks.length === 0) {
        setStatus("no-results");
        return;
      }
      setStatus("idle");
    } catch {
      setStatus("search-error");
    }
  };

  const suggest = async (track: Track) => {
    if (isBusy) return;
    clearBlurTimeout();
    setFocused(false);
    setPendingTrackLabel(`${track.artist} — ${track.title}`);
    setStatus("submitting");
    try {
      const res = await fetch("/api/music/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmedQuery,
          ...track,
        }),
      });
      if (res.status === 403) {
        const data = (await res.json()) as { message?: string };
        if (data?.message) setDisabledMessage(data.message);
        setEnabled(false);
        setStatus("idle");
        return;
      }
      if (!res.ok) throw new Error("suggest failed");
      setStatus("sent");
      setResults([]);
      setArtists([]);
      setSearchTracks([]);
      setSelectedArtist(null);
      setQuery("");
      setHasSearchedCurrentQuery(false);
    } catch {
      setStatus("submit-error");
    }
  };

  const insertText = (text: string) => {
    setQuery((prev) => prev + text);
    setHasSearchedCurrentQuery(false);
    focusInput();
  };

  const backspace = () => {
    setQuery((prev) => prev.slice(0, -1));
    setHasSearchedCurrentQuery(false);
    focusInput();
  };

  const showArtists = artists.length > 0 && !selectedArtist && status !== "submitting";
  const showTracks = results.length > 0 && status !== "submitting";

  return (
    <div className="music-panel">
      {!enabled ? (
        <div className="music-disabled">{disabledMessage}</div>
      ) : null}
      <div className="music-search">
        <div className="music-search-field">
          <input
            ref={inputRef}
            className="input music-input"
            placeholder="Введите исполнителя и название"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHasSearchedCurrentQuery(false);
            }}
            onFocus={() => {
              clearBlurTimeout();
              setFocused(true);
            }}
            onBlur={() => {
              if (keyboardInteractRef.current) return;
              clearBlurTimeout();
              blurTimeoutRef.current = window.setTimeout(() => {
                setFocused(false);
                blurTimeoutRef.current = null;
              }, 150);
            }}
            disabled={!enabled}
          />
          {enabled && !hasSearchedCurrentQuery ? (
            <div className="music-warning">
              Заказанная песня будет проходить цензуру перед передачей диджею.
            </div>
          ) : null}
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={search}
          disabled={!enabled || isBusy}
        >
          {status === "searching" ? "Ищем..." : status === "submitting" ? "Отправляем..." : "Найти"}
        </button>
      </div>

      {status === "searching" && <div>Поиск...</div>}
      {status === "no-results" && (
        <div>Ничего не найдено. Уточните запрос.</div>
      )}
      {status === "search-error" && (
        <div>Не удалось найти песню. Попробуйте позже.</div>
      )}
      {status === "submit-error" && (
        <div className="music-feedback music-feedback-error">
          Не удалось отправить заявку. Попробуйте еще раз.
        </div>
      )}
      {status === "sent" && (
        <div className="music-feedback music-feedback-success">
          Спасибо! Заявка отправлена диджею.
          <br />
          Если нажали несколько раз за {DUPLICATE_HINT_WINDOW_SECONDS} секунд, дубликаты
          будут отброшены автоматически.
        </div>
      )}

      {enabled && showArtists ? (
        <div className="music-section">
          <div className="music-section-head">
            <div className="music-section-title">Исполнители</div>
            <div className="weather-sub">Нажмите, чтобы открыть треки</div>
          </div>
          <div className="music-results music-results-artists">
            {artists.map((artist) => (
              <button
                key={artist.artistId}
                className="music-card music-card-artist"
                type="button"
                onClick={() => loadArtistTracks(artist)}
                disabled={isBusy}
              >
                {artist.coverUrl ? (
                  <img className="music-cover music-cover-artist" src={artist.coverUrl} alt="" />
                ) : (
                  <div className="music-cover music-cover-artist placeholder">🎤</div>
                )}
                <div className="music-meta">
                  <div className="music-title">{artist.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {enabled && (selectedArtist || showTracks) ? (
        <div className="music-section">
          <div className="music-section-head">
            <div className="music-section-title">
              {selectedArtist ? `Треки: ${selectedArtist.name}` : "Найденные треки"}
            </div>
            {selectedArtist ? (
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setSelectedArtist(null);
                  setResults(searchTracks);
                  setStatus(
                    searchTracks.length === 0 && artists.length === 0
                      ? "no-results"
                      : "idle"
                  );
                }}
              >
                ← К поиску
              </button>
            ) : null}
          </div>
          {showTracks ? (
            <div className="music-results">
              {results.map((track) => (
                <button
                  key={track.trackId}
                  className="music-card"
                  type="button"
                  onClick={() => suggest(track)}
                  disabled={isBusy}
                >
                  {track.coverUrl ? (
                    <img className="music-cover" src={track.coverUrl} alt="" />
                  ) : (
                    <div className="music-cover placeholder">🎵</div>
                  )}
                  <div className="music-meta">
                    <div className="music-title">
                      {track.artist} — {track.title}
                    </div>
                    {track.year ? (
                      <div className="music-year">{track.year}</div>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {focused && enabled ? (
        <Keyboard
          onKeyPress={insertText}
          onBackspace={backspace}
          onSpace={() => insertText(" ")}
          onHide={() => {
            clearBlurTimeout();
            setFocused(false);
          }}
          onInteractStart={() => {
            clearBlurTimeout();
            keyboardInteractRef.current = true;
          }}
          onInteractEnd={() => {
            setTimeout(() => {
              keyboardInteractRef.current = false;
              focusInput();
            }, 0);
          }}
        />
      ) : null}
      {status === "submitting" ? (
        <div
          className="kiosk-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="music-submit-title"
          aria-describedby="music-submit-text"
        >
          <div className="kiosk-modal-card">
            <div className="kiosk-modal-title" id="music-submit-title">
              Отправка
            </div>
            <div className="kiosk-modal-text" id="music-submit-text">
              Подождите, заявка отправляется диджею.
            </div>
            {pendingTrackLabel ? (
              <div className="music-modal-track">{pendingTrackLabel}</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
