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
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
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

  // Monitor size of the parent element to resolve 0-size initialization issue
  useEffect(() => {
    const htmlElement = bookContainerRef.current;
    if (!htmlElement) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setSize({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });

    observer.observe(htmlElement);
    return () => {
      observer.disconnect();
    };
  }, []);

  // Initialize PageFlip with resolved size
  useEffect(() => {
    if (!bookContainerRef.current || activeItems.length === 0 || !size) return;

    let flipBook: any = null;
    const htmlElement = bookContainerRef.current;

    const initBook = () => {
      try {
        flipBook = new PageFlip(htmlElement, {
          width: size.width,
          height: size.height,
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
          clickEventForward: true, // Let buttons be clickable
        });

        const domElements = htmlElement.querySelectorAll(".book-page-element");
        if (domElements.length > 0) {
          flipBook.loadFromHTML(domElements);
          pageFlipRef.current = flipBook;
          setIsInitialized(true);

          flipBook.on("flip", (e: any) => {
            const nextIdx = e.data;
            setIndex(nextIdx);

            // Handle video play/pause in raw DOM to avoid React reconciliation conflicts
            const pages = htmlElement.querySelectorAll(".book-page-element");
            pages.forEach((page: any, pIdx: number) => {
              const video = page.querySelector("video");
              if (video) {
                if (pIdx === nextIdx) {
                  video.currentTime = 0;
                  video.play().catch(() => {});
                } else {
                  video.pause();
                }
              }
            });
          });

          // Autoplay first page video if exists
          const firstVideo = domElements[0]?.querySelector("video");
          if (firstVideo) {
            firstVideo.play().catch(() => {});
          }
        }
      } catch (error) {
        console.error("Failed to initialize PageFlip:", error);
      }
    };

    initBook();

    return () => {
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
  }, [activeItems, size]);

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
          opacity: isInitialized ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      >
        {activeItems.map((item) => (
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
