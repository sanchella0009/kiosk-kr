"use client";

import { useState } from "react";

export function CleanupUploadsButton() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    const ok = window.confirm(
      "Удалить локальные файлы uploads, которых нет в базе?"
    );
    if (!ok) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/media/cleanup", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("failed");
      const data = (await res.json()) as { deleted: number; total: number };
      setStatus(`Удалено: ${data.deleted} из ${data.total}`);
    } catch {
      setStatus("Ошибка очистки");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <button className="btn-ghost" type="button" onClick={onClick} disabled={loading}>
        {loading ? "Очистка..." : "Очистить uploads"}
      </button>
      {status ? (
        <div style={{ marginTop: 8, color: "var(--ink-muted)" }}>{status}</div>
      ) : null}
    </div>
  );
}
