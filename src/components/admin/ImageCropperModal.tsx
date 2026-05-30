"use client";

import { useEffect, useState, useRef } from "react";

type Props = {
  src: string;
  onCancel: () => void;
  onSave: (croppedBlob: Blob) => void;
};

export function ImageCropperModal({ src, onCancel, onSave }: Props) {
  const [scale, setScale] = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [imgError, setImgError] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const cropSize = 240; // Diameter of the crop circle in container px
  const containerSize = 320; // Size of the square container px

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setImgSize({ w: naturalWidth, h: naturalHeight });
    setImgError(false);

    // Calculate minimum scale to cover the crop circle
    const min = Math.max(cropSize / naturalWidth, cropSize / naturalHeight);
    setMinScale(min);
    setScale(min);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!imgSize || imgError) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !imgSize || imgError) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    const maxX = Math.max(0, (imgSize.w * scale - cropSize) / 2);
    const maxY = Math.max(0, (imgSize.h * scale - cropSize) / 2);

    setPosition({
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY)),
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || !imgSize || imgError) return;
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !imgSize || imgError || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const newX = touch.clientX - dragStart.x;
    const newY = touch.clientY - dragStart.y;

    const maxX = Math.max(0, (imgSize.w * scale - cropSize) / 2);
    const maxY = Math.max(0, (imgSize.h * scale - cropSize) / 2);

    setPosition({
      x: Math.max(-maxX, Math.min(maxX, newX)),
      y: Math.max(-maxY, Math.min(maxY, newY)),
    });
  };

  const handleScaleChange = (newVal: number) => {
    if (!imgSize || imgError) return;
    setScale(newVal);

    const maxX = Math.max(0, (imgSize.w * newVal - cropSize) / 2);
    const maxY = Math.max(0, (imgSize.h * newVal - cropSize) / 2);

    setPosition((prev) => ({
      x: Math.max(-maxX, Math.min(maxX, prev.x)),
      y: Math.max(-maxY, Math.min(maxY, prev.y)),
    }));
  };

  // Perform canvas cropping and invoke callback
  const handleSaveClick = () => {
    if (!imgSize || !imgRef.current || imgError) return;
    setSaving(true);

    const img = imgRef.current;
    const canvas = document.createElement("canvas");
    const outputSize = 400; // Output high-quality resolution (400x400)
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setSaving(false);
      return;
    }

    // Enable high quality scaling to prevent aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Source dimensions inside the raw image
    const sourceWidth = cropSize / scale;
    const sourceHeight = cropSize / scale;
    const sourceX = imgSize.w / 2 - (position.x + cropSize / 2) / scale;
    const sourceY = imgSize.h / 2 - (position.y + cropSize / 2) / scale;

    ctx.drawImage(
      img,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      outputSize,
      outputSize
    );

    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (blob) {
          onSave(blob);
        }
      },
      "image/jpeg",
      0.9
    );
  };

  // Global mouse up event safety
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(26, 26, 26, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          boxShadow: "0 20px 40px rgba(0,0,0,0.35)",
        }}
      >
        <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
          Кадрирование фото
        </h3>
        <p style={{ fontSize: 14, color: "var(--ink-muted)", margin: 0, lineHeight: 1.4 }}>
          Перетаскивайте изображение мышкой или пальцем и используйте ползунок для масштабирования, чтобы фото идеально вписалось в круг.
        </p>

        {/* Cropping viewport */}
        {imgError ? (
          <div
            style={{
              width: containerSize,
              height: containerSize,
              margin: "8px auto",
              borderRadius: 14,
              background: "#fff5f5",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
              color: "#c53030",
              border: "2px dashed #feb2b2",
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: 44, height: 44, marginBottom: 12 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ fontWeight: 600, fontSize: 15 }}>
              Не удалось загрузить фото
            </span>
            <span style={{ fontSize: 12, marginTop: 4, opacity: 0.8, lineHeight: 1.3 }}>
              Убедитесь, что файл является изображением и не поврежден.
            </span>
          </div>
        ) : (
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
            style={{
              width: containerSize,
              height: containerSize,
              margin: "8px auto",
              position: "relative",
              overflow: "hidden",
              borderRadius: 14,
              background: "var(--bg-deep)",
              userSelect: "none",
              touchAction: "none",
            }}
          >
            {/* Circular crop boundary hole */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: cropSize,
                height: cropSize,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                boxShadow: "0 0 0 9999px rgba(26, 26, 26, 0.65)",
                border: "2px solid var(--accent)",
                pointerEvents: "none",
                zIndex: 2,
              }}
            />

            {/* Underlay image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={src}
              alt="Source"
              onLoad={onImgLoad}
              onError={() => setImgError(true)}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: "center center",
                maxWidth: "none",
                maxHeight: "none",
                width: imgSize ? `${imgSize.w}px` : "auto",
                height: imgSize ? `${imgSize.h}px` : "auto",
                cursor: isDragging ? "grabbing" : "grab",
                zIndex: 1,
              }}
            />
          </div>
        )}

        {/* Zoom slider */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-muted)" }}>
            Масштаб: {imgError ? "0%" : `${Math.round((scale / minScale) * 100)}%`}
          </label>
          <input
            type="range"
            min={minScale}
            max={minScale * 3.5}
            step={0.005}
            value={scale}
            disabled={imgError || !imgSize}
            onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
            style={{
              width: "100%",
              cursor: imgError ? "not-allowed" : "pointer",
              accentColor: "var(--accent)",
              opacity: imgError ? 0.5 : 1,
            }}
          />
        </div>

        {/* Modal actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={saving}
            style={{ padding: "8px 16px" }}
          >
            Отмена
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSaveClick}
            disabled={saving || !imgSize || imgError}
            style={{ padding: "8px 16px", minWidth: 100 }}
          >
            {saving ? "Сжатие..." : "Принять"}
          </button>
        </div>
      </div>
    </div>
  );
}
