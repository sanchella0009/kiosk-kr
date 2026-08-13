"use client";

import { useState } from "react";
import { syncVkMenuAction } from "@/app/actions/vk";

export function VkSyncButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await syncVkMenuAction();
      setStatus({ success: res.success, message: res.message });
    } catch (e: any) {
      setStatus({ success: false, message: e.message || "Ошибка соединения" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid #f2f2f2" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleSync}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "var(--accent-2, #3e6344)",
            color: "#fff",
            border: "none",
            padding: "10px 16px",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            transition: "opacity 0.2s",
          }}
        >
          {loading ? "🔄 Синхронизация..." : "🔵 Синхронизировать меню из ВК"}
        </button>
        <span style={{ fontSize: 13, color: "var(--ink-muted, #818c99)" }}>
          Импорт последних постов группы VK с ключевым словом «меню»
        </span>
      </div>

      {status && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 6,
            fontSize: 14,
            border: status.success ? "1px solid #cfe8d0" : "1px solid #f5c2c2",
            backgroundColor: status.success ? "#f4fcf5" : "#fdf3f3",
            color: status.success ? "#1f5f2c" : "#a12323",
          }}
        >
          {status.success ? "✅ " : "❌ "}
          {status.message}
        </div>
      )}
    </div>
  );
}
