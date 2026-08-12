"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageFlip } from "page-flip";

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
  
  const bookContainerRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<any | null>(null);
  const [index, setIndex] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const timerRef = useRef<number | null>(null);

  const goNext = () => {
    if (pageFlipRef.current) {
      pageFlipRef.current.flipNext();
    }
  };

  const goPrev = () => {
    if (pageFlipRef.current) {
      pageFlipRef.current.flipPrev();
    }
  };

  // Initialize PageFlip
  useEffect(() => {
    if (!bookContainerRef.current || activeItems.length === 0) return;

    let flipBook: any = null;
    let timerId: any = null;

    const initBook = () => {
      const htmlElement = bookContainerRef.current;
      if (!htmlElement) return;

      const rect = htmlElement.getBoundingClientRect();
      const roundedWidth = Math.round(rect.width) || 400;
      const roundedHeight = Math.round(rect.height) || 600;

      try {
        flipBook = new PageFlip(htmlElement, {
          width: roundedWidth,
          height: roundedHeight,
          size: "stretch",
          minWidth: 100,
          maxWidth: 2000,
          minHeight: 100,
          maxHeight: 2000,
          drawShadow: true,
          maxShadowOpacity: 0.3,
          showCover: false,
          mobileScrollSupport: false,
          usePortrait: true,
          clickEventForward: true, // forward clicks to sub-elements
        });

        const domElements = htmlElement.querySelectorAll(".book-page-element");
        if (domElements.length > 0) {
          flipBook.loadFromHTML(domElements);
          pageFlipRef.current = flipBook;
          setIsInitialized(true);

          flipBook.on("flip", (e: any) => {
            setIndex(e.data);
          });
        }
      } catch (error) {
        console.error("Failed to initialize PageFlip:", error);
      }
    };

    // Delay initialization slightly to let parent container dimensions compute
    timerId = setTimeout(initBook, 300);

    return () => {
      clearTimeout(timerId);
      if (flipBook) {
        try {
          flipBook.destroy();
        } catch (e) {
          console.error("Failed to destroy PageFlip:", e);
        }
      }
      pageFlipRef.current = null;
      setIsInitialized(false);
    };
  }, [activeItems]);

  // Slideshow Timer logic
  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (activeItems.length <= 1) return;

    const item = activeItems[index];
    if (!item || item.type === "VIDEO") return;

    timerRef.current = window.setTimeout(() => {
      goNext();
    }, PHOTO_INTERVAL);

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeItems, index, isInitialized]);

  if (activeItems.length === 0) {
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
      className="kiosk-media card"
      style={{
        position: "relative",
        padding: 0,
        overflow: "hidden",
        backgroundColor: "#000",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "stretch",
      }}
    >
      {/* Navigation buttons overlay */}
      {activeItems.length > 1 && (
        <>
          <button
            className="media-nav left"
            type="button"
            style={{ zIndex: 100 }}
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
          />
          <button
            className="media-nav right"
            type="button"
            style={{ zIndex: 100 }}
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
          />
        </>
      )}

      {/* PageFlip Wrapper */}
      <div
        ref={bookContainerRef}
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        {activeItems.map((item, idx) => (
          <div
            key={item.id}
            className="book-page-element"
            style={{
              width: "100%",
              height: "100%",
              backgroundColor: "#000",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {item.type === "PHOTO" ? (
              <img
                src={item.url}
                alt={item.title ?? "Медиа"}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            ) : (
              <video
                src={item.url}
                autoPlay={index === idx}
                muted
                playsInline
                controls={false}
                onEnded={() => activeItems.length > 1 && goNext()}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
