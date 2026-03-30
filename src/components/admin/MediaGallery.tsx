"use client";

import { useEffect, useState } from "react";

type MediaItem = {
  id: string;
  url: string;
  type: "PHOTO" | "VIDEO";
  isActive: boolean;
  createdAt: string;
};

type Props = {
  category: "MAIN";
};

export function MediaGallery({ category }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/media?category=${category}`, {
      cache: "no-store",
    });
    const data = (await res.json()) as { items: MediaItem[] };
    setItems(data.items);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [category]);

  const remove = async (id: string) => {
    const ok = window.confirm("Вы точно уверены?");
    if (!ok) return;
    await fetch(`/api/media/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (activeIndex != null && items[activeIndex]?.id === id) {
      setActiveIndex(null);
    }
    load();
  };

  const open = (index: number) => {
    setActiveIndex(index);
    setIsMuted(true);
  };
  const close = () => setActiveIndex(null);
  const next = () => {
    if (items.length === 0 || activeIndex == null) return;
    setActiveIndex((activeIndex + 1) % items.length);
  };
  const prev = () => {
    if (items.length === 0 || activeIndex == null) return;
    setActiveIndex((activeIndex - 1 + items.length) % items.length);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (activeIndex == null) return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, items.length]);

  if (loading) {
    return <div>Загрузка...</div>;
  }

  return (
    <div className="media-grid">
      {items.length === 0 && <div>Пока нет медиа.</div>}
      {items.map((item, index) => (
        <div key={item.id} className="media-tile">
          <button
            className="media-delete"
            type="button"
            onClick={() => remove(item.id)}
            title="Удалить"
          >
            ✕
          </button>
          <button
            className="media-open"
            type="button"
            onClick={() => open(index)}
          >
            {item.type === "PHOTO" ? (
              <img src={item.url} alt="" />
            ) : (
              <video src={item.url} muted playsInline />
            )}
          </button>
        </div>
      ))}
      {activeIndex != null ? (
        <div className="media-modal">
          <div className="media-modal-content">
            {items[activeIndex]?.type === "PHOTO" ? (
              <img src={items[activeIndex]?.url} alt="" />
            ) : (
              <video
                src={items[activeIndex]?.url}
                controls
                autoPlay
                muted={isMuted}
                playsInline
              />
            )}
            <div className="media-modal-actions">
              <button className="btn-ghost" type="button" onClick={prev}>
                ←
              </button>
              <button className="btn-ghost" type="button" onClick={next}>
                →
              </button>
              {items[activeIndex]?.type === "VIDEO" ? (
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => setIsMuted((prev) => !prev)}
                >
                  {isMuted ? "🔊 Размутить" : "🔇 Заглушить"}
                </button>
              ) : null}
              <button
                className="btn-ghost"
                type="button"
                onClick={() => remove(items[activeIndex].id)}
              >
                Удалить
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={close}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
