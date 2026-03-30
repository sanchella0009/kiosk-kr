"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MediaItem = {
  id: string;
  type: "PHOTO" | "VIDEO";
  title?: string | null;
  url: string;
};

type Props = {
  items: MediaItem[];
};

const PHOTO_INTERVAL = 30_000;

export function MediaPanel({ items }: Props) {
  const activeItems = useMemo(
    () => items.filter((item) => item.url),
    [items]
  );
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const timerRef = useRef<number | null>(null);
  const swipeRef = useRef({
    startX: 0,
    startY: 0,
    active: false,
    triggered: false,
  });

  const goTo = (nextIndex: number, dir: "next" | "prev") => {
    setDirection(dir);
    setIndex((prev) => {
      if (activeItems.length === 0) return 0;
      return ((nextIndex % activeItems.length) + activeItems.length) % activeItems.length;
    });
  };

  const goNext = () => goTo(index + 1, "next");
  const goPrev = () => goTo(index - 1, "prev");

  useEffect(() => {
    if (activeItems.length === 0) return;
    setIndex((prev) => Math.min(prev, activeItems.length - 1));
  }, [activeItems.length]);

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const item = activeItems[index];
    if (!item || item.type === "VIDEO") return;
    timerRef.current = window.setTimeout(() => {
      if (activeItems.length > 1) {
        goNext();
      }
    }, PHOTO_INTERVAL);
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeItems, index]);

  const item = activeItems[index];

  if (!item) {
    return (
      <div
        className="kiosk-media card"
        style={{ display: "grid", placeItems: "center" }}
      >
        Загрузите фото или видео в админке
      </div>
    );
  }

  return (
    <div
      className={`kiosk-media card page-turn ${
        direction === "next" ? "page-next" : "page-prev"
      }`}
      onPointerDown={(event) => {
        swipeRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          active: true,
          triggered: false,
        };
      }}
      onPointerMove={(event) => {
        const swipe = swipeRef.current;
        if (!swipe.active || swipe.triggered) return;
        const dx = event.clientX - swipe.startX;
        const dy = event.clientY - swipe.startY;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
          swipe.triggered = true;
          if (dx < 0) goNext();
          else goPrev();
        }
      }}
      onPointerUp={() => {
        swipeRef.current.active = false;
      }}
      onPointerCancel={() => {
        swipeRef.current.active = false;
      }}
    >
      <button
        className="media-nav left"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={goPrev}
      />
      <button
        className="media-nav right"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={goNext}
      />
      {item.type === "PHOTO" ? (
        <img
          key={item.id}
          src={item.url}
          alt={item.title ?? "Медиа"}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <video
          key={item.id}
          src={item.url}
          autoPlay
          muted
          playsInline
          onEnded={() => activeItems.length > 1 && goNext()}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      )}
      {/* подписи не показываем на главном экране */}
    </div>
  );
}
