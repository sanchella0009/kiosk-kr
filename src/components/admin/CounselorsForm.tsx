"use client";

import { useState } from "react";
import { ImageCropperModal } from "./ImageCropperModal";

type Counselor = {
  id: string;
  name: string;
  photoUrl: string | null;
  category: string;
  position: string;
};

type Props = {
  shift: {
    id: string;
    title: string | null;
    startDate: Date;
    endDate: Date;
    counselors: string | null;
  };
  saveCounselorsAction: (shiftId: string, counselorsJson: string) => Promise<{ success: boolean; error?: string }>;
};

export function CounselorsForm({ shift, saveCounselorsAction }: Props) {
  const [counselors, setCounselors] = useState<Counselor[]>(() => {
    if (!shift.counselors) return [];
    try {
      const parsed = JSON.parse(shift.counselors) as any[];
      return parsed.map((c) => ({
        id: c.id,
        name: c.name || "",
        photoUrl: c.photoUrl || null,
        category: c.category || "Администрация",
        position: c.position || "",
      }));
    } catch {
      return [];
    }
  });

  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Администрация");
  const [newPosition, setNewPosition] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Cropper state
  const [croppingImage, setCroppingImage] = useState<{ src: string; index?: number } | null>(null);

  const handleFileChange = (file: File, index?: number) => {
    const src = URL.createObjectURL(file);
    setCroppingImage({ src, index });
  };

  const handleStartRecrop = (src: string, index?: number) => {
    setCroppingImage({ src, index });
  };

  const handleCancelCrop = () => {
    if (croppingImage && croppingImage.src.startsWith("blob:")) {
      URL.revokeObjectURL(croppingImage.src);
    }
    setCroppingImage(null);
  };

  const handleSaveCrop = (blob: Blob) => {
    if (!croppingImage) return;
    if (croppingImage.src.startsWith("blob:")) {
      URL.revokeObjectURL(croppingImage.src);
    }
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    handlePhotoUpload(file, croppingImage.index);
    setCroppingImage(null);
  };

  const handlePhotoUpload = async (file: File, index?: number) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/editor/upload-image", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { url?: string };
      if (data.url) {
        if (index !== undefined) {
          setCounselors((prev) =>
            prev.map((c, i) => (i === index ? { ...c, photoUrl: data.url! } : c))
          );
        } else {
          setNewPhotoUrl(data.url);
        }
      }
    } catch {
      alert("Не удалось загрузить фото");
    } finally {
      setUploading(false);
    }
  };

  const addCounselor = () => {
    if (!newName.trim()) return;
    const newCounselor: Counselor = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      photoUrl: newPhotoUrl,
      category: newCategory.trim() || "Вожатые",
      position: newPosition.trim(),
    };
    setCounselors((prev) => [...prev, newCounselor]);
    setNewName("");
    setNewPosition("");
    setNewPhotoUrl(null);
  };

  const removeCounselor = (id: string) => {
    setCounselors((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCounselorName = (index: number, name: string) => {
    setCounselors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, name } : c))
    );
  };

  const updateCounselorCategory = (index: number, category: string) => {
    setCounselors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, category } : c))
    );
  };

  const updateCounselorPosition = (index: number, position: string) => {
    setCounselors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, position } : c))
    );
  };

  const removePhoto = (index: number) => {
    setCounselors((prev) =>
      prev.map((c, i) => (i === index ? { ...c, photoUrl: null } : c))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const json = JSON.stringify(counselors);
      const res = await saveCounselorsAction(shift.id, json);
      if (res.success) {
        setMessage("Сохранено успешно!");
      } else {
        setMessage(res.error || "Ошибка при сохранении");
      }
    } catch {
      setMessage("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="list" style={{ gap: 16 }}>
      <div className="counselors-list" style={{ display: "grid", gap: 12 }}>
        {counselors.map((counselor, index) => (
          <div
            key={counselor.id}
            className="pill"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "12px 16px",
              borderRadius: 16,
              background: "#fff",
              border: "1px solid #f3d6a0",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                overflow: "hidden",
                background: "#f0e4cc",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "2px solid #e86a33",
                position: "relative",
              }}
            >
              {counselor.photoUrl ? (
                <img
                  src={counselor.photoUrl}
                  alt={counselor.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#4b4b4b"
                  strokeWidth="1.5"
                  style={{ width: 28, height: 28 }}
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 6 }}>
              <input
                className="input"
                style={{ padding: "6px 10px", fontSize: 15 }}
                type="text"
                placeholder="Имя и отчество"
                value={counselor.name}
                onChange={(e) => updateCounselorName(index, e.target.value)}
              />
              <input
                className="input"
                style={{ padding: "6px 10px", fontSize: 13, borderColor: "#e2c080" }}
                type="text"
                placeholder="Категория (например: Администрация, Вожатые 1 отряда)"
                value={counselor.category}
                onChange={(e) => updateCounselorCategory(index, e.target.value)}
              />
              <input
                className="input"
                style={{ padding: "6px 10px", fontSize: 13, borderColor: "#cbd5e1" }}
                type="text"
                placeholder="Должность (например: Вожатый, Директор)"
                value={counselor.position || ""}
                onChange={(e) => updateCounselorPosition(index, e.target.value)}
              />
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <label
                  className="btn-ghost"
                  style={{
                    padding: "4px 10px",
                    fontSize: 13,
                    cursor: "pointer",
                    display: "inline-block",
                  }}
                >
                  Выбрать фото
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileChange(file, index);
                    }}
                  />
                </label>
                {counselor.photoUrl && (
                  <>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 13, borderColor: "var(--accent)", color: "var(--accent)" }}
                      onClick={() => handleStartRecrop(counselor.photoUrl!, index)}
                    >
                      Кадрировать
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: "4px 10px", fontSize: 13, borderColor: "#b1462b", color: "#b1462b" }}
                      onClick={() => removePhoto(index)}
                    >
                      Удалить фото
                    </button>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              className="btn-ghost"
              style={{
                borderColor: "#b1462b",
                color: "#b1462b",
                padding: "8px 12px",
              }}
              onClick={() => removeCounselor(counselor.id)}
            >
              Удалить
            </button>
          </div>
        ))}

        {counselors.length === 0 && (
          <div style={{ color: "var(--ink-muted)", fontStyle: "italic" }}>
            Сотрудники не добавлены
          </div>
        )}
      </div>

      <div
        className="add-counselor-form"
        style={{
          padding: 16,
          borderRadius: 16,
          background: "var(--bg-deep)",
          border: "2px dashed #f3d6a0",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <h4 style={{ fontWeight: 600 }}>Добавить сотрудника</h4>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              overflow: "hidden",
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #f3d6a0",
              flexShrink: 0,
            }}
          >
            {newPhotoUrl ? (
              <img
                src={newPhotoUrl}
                alt="Превью"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4b4b4b"
                strokeWidth="1.5"
                style={{ width: 24, height: 24 }}
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              className="input"
              style={{ padding: "8px 12px" }}
              type="text"
              placeholder="Имя и отчество нового сотрудника"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <input
              className="input"
              style={{ padding: "8px 12px" }}
              type="text"
              placeholder="Категория (например: Администрация, Вожатые 1 отряда)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <input
              className="input"
              style={{ padding: "8px 12px" }}
              type="text"
              placeholder="Должность (например: Вожатый, Директор)"
              value={newPosition}
              onChange={(e) => setNewPosition(e.target.value)}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <label
                className="btn-ghost"
                style={{
                  padding: "6px 12px",
                  fontSize: 14,
                  cursor: "pointer",
                  display: "inline-block",
                }}
              >
                Загрузить фото
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileChange(file);
                  }}
                />
              </label>
              {newPhotoUrl && (
                <>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: "6px 12px", fontSize: 14, borderColor: "var(--accent)", color: "var(--accent)" }}
                    onClick={() => handleStartRecrop(newPhotoUrl)}
                  >
                    Кадрировать
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{ padding: "6px 12px", fontSize: 14, borderColor: "#b1462b", color: "#b1462b" }}
                    onClick={() => setNewPhotoUrl(null)}
                  >
                    Сбросить фото
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary"
          style={{ alignSelf: "flex-start" }}
          onClick={addCounselor}
          disabled={!newName.trim() || uploading}
        >
          Добавить в список
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSave}
          disabled={saving || uploading}
          style={{ background: "var(--accent-2)" }}
        >
          {saving ? "Сохранение..." : "Сохранить изменения смены"}
        </button>
        {message && (
          <span
            style={{
              fontWeight: 600,
              color: message.startsWith("Сохранено") ? "#1f5f2c" : "#b1462b",
            }}
          >
            {message}
          </span>
        )}
      </div>

      {croppingImage && (
        <ImageCropperModal
          src={croppingImage.src}
          onCancel={handleCancelCrop}
          onSave={handleSaveCrop}
        />
      )}
    </div>
  );
}
