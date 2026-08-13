"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  
  const viewportRef = useRef<HTMLDivElement>(null);
  const sourceContainerRef = useRef<HTMLDivElement>(null);
  const pageFlipRef = useRef<any | null>(null);
  
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
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

  // Measure viewport container size via ResizeObserver
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        if (width > 0 && height > 0) {
          setSize({ width: Math.round(width), height: Math.round(height) });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Initialize PageFlip with single-page layout (usePortrait: true, showCover: false)
  useLayoutEffect(() => {
    if (!viewportRef.current || !sourceContainerRef.current || activeItems.length === 0 || !size) return;

    // Clear previous contents of viewport
    viewportRef.current.innerHTML = "";

    // Create wrapper node
    const bookWrapper = document.createElement("div");
    bookWrapper.className = "flipbook-wrapper";
    bookWrapper.style.width = `${size.width}px`;
    bookWrapper.style.height = `${size.height}px`;
    bookWrapper.style.position = "relative";
    bookWrapper.style.margin = "0 auto";
    bookWrapper.style.overflow = "hidden";
    viewportRef.current.appendChild(bookWrapper);

    // Query and clone source page elements
    const domSources = sourceContainerRef.current.querySelectorAll(".book-page-element-source");
    const clonedElements: HTMLDivElement[] = [];

    domSources.forEach((el) => {
      const clone = el.cloneNode(true) as HTMLDivElement;
      clone.className = "book-page-element";
      clone.style.width = `${size.width}px`;
      clone.style.height = `${size.height}px`;
      clone.style.display = "block";
      bookWrapper.appendChild(clone);
      clonedElements.push(clone);
    });

    let flipBook: any = null;

    try {
      flipBook = new PageFlip(bookWrapper, {
        width: size.width,
        height: size.height,
        size: "fixed",
        minWidth: 100,
        maxWidth: 2500,
        minHeight: 100,
        maxHeight: 2500,
        drawShadow: true,
        maxShadowOpacity: 0.25, // Soft parchment shadows
        showCover: false, 
        usePortrait: true, 
        mobileScrollSupport: false,
        clickEventForward: true,
      });

      if (clonedElements.length > 0) {
        flipBook.loadFromHTML(clonedElements);
        pageFlipRef.current = flipBook;

        // Start from page 1 (since index 0 is a duplicated boundary page)
        if (activeItems.length > 1) {
          flipBook.turnToPage(1);
        }

        flipBook.on("flip", (e: any) => {
          let virtualIdx = e.data;
          const realCount = activeItems.length;

          // Loop teleportation logic
          if (activeItems.length > 1) {
            if (virtualIdx === realCount + 1) {
              flipBook.turnToPage(1);
              virtualIdx = 1;
            } else if (virtualIdx === 0) {
              flipBook.turnToPage(realCount);
              virtualIdx = realCount;
            }
          }

          const nextIdx = activeItems.length > 1 ? virtualIdx - 1 : virtualIdx;
          setIndex(nextIdx);

          // Handle videos in active vs inactive pages
          clonedElements.forEach((pageEl, pIdx) => {
            const video = pageEl.querySelector("video");
            if (video) {
              if (pIdx === virtualIdx) {
                video.currentTime = 0;
                video.play().catch(() => {});
              } else {
                video.pause();
              }
            }
          });
        });

        // Autoplay initial video if first page is a video
        const firstVideo = clonedElements[activeItems.length > 1 ? 1 : 0]?.querySelector("video");
        if (firstVideo) {
          firstVideo.play().catch(() => {});
        }
      }
    } catch (error) {
      console.error("Failed to initialize PageFlip in MediaPanel:", error);
    }

    return () => {
      if (flipBook) {
        try {
          flipBook.destroy();
        } catch (e) {}
      }
      pageFlipRef.current = null;
      if (viewportRef.current) {
        viewportRef.current.innerHTML = "";
      }
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
  }, [activeItems, index]);

  const renderSourcePage = (item: MediaItem, key: string) => {
    return (
      <div
        key={key}
        className="book-page-element-source"
        style={{
          backgroundColor: "#f7efe0", // Restored original warm cream color
          // Soft book crease page binding shadow
          boxShadow: "inset 20px 0 30px -10px rgba(0, 0, 0, 0.15), inset -6px 0 12px -6px rgba(0, 0, 0, 0.1)",
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
    );
  };

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
        backgroundColor: "#f7efe0", // Restored original warm cream background
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

      {/* Viewport container */}
      <div
        ref={viewportRef}
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      />

      {/* Hidden React source pages for PageFlip cloning */}
      <div ref={sourceContainerRef} style={{ display: "none" }}>
        {/* Prepend duplicate of last page for backward infinite looping */}
        {activeItems.length > 1 &&
          renderSourcePage(activeItems[activeItems.length - 1], "last-clone")}

        {/* Real pages */}
        {activeItems.map((item) => renderSourcePage(item, item.id))}

        {/* Append duplicate of first page for forward infinite looping */}
        {activeItems.length > 1 &&
          renderSourcePage(activeItems[0], "first-clone")}
      </div>
    </div>
  );
}
