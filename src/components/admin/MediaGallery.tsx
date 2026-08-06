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

type SortByOption = "newest" | "oldest";

export function MediaGallery({ category }: Props) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(true);

  // Sorting, grouping, and selection states
  const [sortBy, setSortBy] = useState<SortByOption>("newest");
  const [groupByDate, setGroupByDate] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(24);

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
    setSelectedIds([]);
    setSelectionMode(false);
    setVisibleCount(24);
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

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    const ok = window.confirm(`Вы действительно хотите удалить выбранные слайды (${selectedIds.length} шт.)?`);
    if (!ok) return;

    setLoading(true);
    try {
      const res = await fetch("/api/media", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (!res.ok) {
        throw new Error("Failed to delete");
      }
      setSelectedIds([]);
      setSelectionMode(false);
      await load();
    } catch (err) {
      alert("Ошибка при удалении: " + (err instanceof Error ? err.message : "неизвестная ошибка"));
      setLoading(false);
    }
  };

  const selectAll = () => {
    setSelectedIds(items.map((item) => item.id));
  };

  const clearSelection = () => {
    setSelectedIds([]);
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

  const getGroupKey = (createdAtString: string) => {
    const d = new Date(createdAtString);
    return d.toISOString().split("T")[0];
  };

  const getGroupTitle = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Сегодня";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Вчера";
    } else {
      return date.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  };

  if (loading && items.length === 0) {
    return <div>Загрузка...</div>;
  }

  // 1. Sort items
  const sortedItems = [...items].sort((a, b) => {
    const timeA = new Date(a.createdAt).getTime();
    const timeB = new Date(b.createdAt).getTime();
    return sortBy === "newest" ? timeB - timeA : timeA - timeB;
  });

  // 2. Paginate sorted items
  const paginatedItems = sortedItems.slice(0, visibleCount);

  // 3. Group items if needed
  const grouped: { [key: string]: MediaItem[] } = {};
  const groupKeys: string[] = [];

  if (groupByDate) {
    for (const item of paginatedItems) {
      const key = getGroupKey(item.createdAt);
      if (!grouped[key]) {
        grouped[key] = [];
        groupKeys.push(key);
      }
      grouped[key].push(item);
    }
  }

  const isAllGroupSelected = (groupItems: MediaItem[]) => {
    return groupItems.every((item) => selectedIds.includes(item.id));
  };

  const toggleGroupSelection = (groupItems: MediaItem[]) => {
    const groupIds = groupItems.map((item) => item.id);
    const allSelected = isAllGroupSelected(groupItems);

    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !groupIds.includes(id)));
    } else {
      setSelectedIds((prev) => {
        const next = [...prev];
        for (const id of groupIds) {
          if (!next.includes(id)) {
            next.push(id);
          }
        }
        return next;
      });
    }
  };

  const renderTile = (item: MediaItem) => {
    const isSelected = selectedIds.includes(item.id);
    const index = items.indexOf(item);

    const handleTileClick = () => {
      if (selectionMode) {
        if (isSelected) {
          setSelectedIds((prev) => prev.filter((id) => id !== item.id));
        } else {
          setSelectedIds((prev) => [...prev, item.id]);
        }
      } else {
        open(index);
      }
    };

    return (
      <div
        key={item.id}
        className="media-tile"
        style={{
          border: isSelected ? "2px solid var(--accent-2)" : "2px solid transparent",
          boxShadow: isSelected ? "0 4px 12px rgba(0, 0, 0, 0.15)" : undefined,
          transform: isSelected ? "scale(0.98)" : "none",
          transition: "all 0.15s ease",
        }}
      >
        {selectionMode && (
          <div
            style={{
              position: "absolute",
              top: 8,
              left: 8,
              zIndex: 10,
              background: isSelected ? "var(--accent-2)" : "rgba(255, 255, 255, 0.8)",
              color: isSelected ? "#fff" : "transparent",
              width: 24,
              height: 24,
              borderRadius: 6,
              border: isSelected ? "none" : "2px solid var(--accent-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
              fontSize: 14,
              boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
              pointerEvents: "none",
            }}
          >
            {isSelected ? "✓" : ""}
          </div>
        )}
        {!selectionMode && (
          <button
            className="media-delete"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              remove(item.id);
            }}
            title="Удалить"
          >
            ✕
          </button>
        )}
        <button
          className="media-open"
          type="button"
          onClick={handleTileClick}
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          {item.type === "PHOTO" ? (
            <img src={item.url} alt="" loading="lazy" />
          ) : (
            <video src={item.url} muted playsInline preload="none" />
          )}
        </button>
      </div>
    );
  };

  return (
    <div>
      {/* Controls Panel */}
      <div
        className="media-gallery-controls"
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          padding: "12px 16px",
          background: "var(--bg-deep)",
          borderRadius: 12,
          border: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="sortOrderSelect" style={{ fontSize: 14, fontWeight: 500 }}>
            Сортировка:
          </label>
          <select
            id="sortOrderSelect"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortByOption)}
            className="input"
            style={{ width: "auto", padding: "6px 12px", margin: 0, height: 36 }}
          >
            <option value="newest">Сначала новые</option>
            <option value="oldest">Сначала старые</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            id="groupByDateCheck"
            checked={groupByDate}
            onChange={(e) => setGroupByDate(e.target.checked)}
            style={{ width: 18, height: 18, cursor: "pointer" }}
          />
          <label
            htmlFor="groupByDateCheck"
            style={{ fontSize: 14, fontWeight: 500, cursor: "pointer", userSelect: "none" }}
          >
            Группировать по дате
          </label>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 10, flexWrap: "wrap" }}>
          {selectionMode ? (
            <>
              <button
                className="btn-ghost"
                type="button"
                onClick={selectAll}
                style={{ padding: "6px 12px", fontSize: 13, height: 36 }}
              >
                Выбрать все
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={clearSelection}
                style={{ padding: "6px 12px", fontSize: 13, height: 36 }}
              >
                Снять выделение
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedIds([]);
                }}
                style={{ padding: "6px 12px", fontSize: 13, height: 36 }}
              >
                Отмена
              </button>
              <button
                className="btn-primary"
                type="button"
                onClick={deleteSelected}
                disabled={selectedIds.length === 0}
                style={{
                  padding: "6px 12px",
                  fontSize: 13,
                  height: 36,
                  background: selectedIds.length === 0 ? "#e2e2e2" : "#b1462b",
                  borderColor: selectedIds.length === 0 ? "#e2e2e2" : "#b1462b",
                  color: selectedIds.length === 0 ? "#8c8c8c" : "#fff",
                }}
              >
                Удалить выбранные ({selectedIds.length})
              </button>
            </>
          ) : (
            <button
              className="btn-ghost"
              type="button"
              onClick={() => setSelectionMode(true)}
              style={{ padding: "6px 12px", fontSize: 13, height: 36 }}
            >
              Выбрать несколько
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div>Пока нет медиа.</div>
      ) : groupByDate ? (
        groupKeys.map((key) => (
          <div key={key} className="media-group" style={{ marginBottom: 28 }}>
            <h3
              className="group-heading"
              style={{
                margin: "20px 0 12px 0",
                fontSize: 15,
                fontWeight: 600,
                color: "var(--ink)",
                borderBottom: "1px solid var(--border)",
                paddingBottom: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>📅 {getGroupTitle(key)}</span>
              {selectionMode && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: "4px 8px", fontSize: 12, height: "auto", border: "1px solid var(--border)" }}
                  onClick={() => toggleGroupSelection(grouped[key])}
                >
                  {isAllGroupSelected(grouped[key]) ? "Снять выделение" : "Выбрать группу"}
                </button>
              )}
            </h3>
            <div className="media-grid">
              {grouped[key].map((item) => renderTile(item))}
            </div>
          </div>
        ))
      ) : (
        <div className="media-grid">
          {paginatedItems.map((item) => renderTile(item))}
        </div>
      )}

      {visibleCount < items.length && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 24, marginBottom: 12 }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setVisibleCount((prev) => prev + 24)}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              borderColor: "var(--accent-2)",
              color: "var(--accent-2)",
              borderRadius: 8,
            }}
          >
            Показать еще (осталось {items.length - visibleCount})
          </button>
        </div>
      )}

      {/* Modal viewer */}
      {activeIndex != null && items[activeIndex] ? (
        <div className="media-modal">
          <div className="media-modal-content">
            {items[activeIndex].type === "PHOTO" ? (
              <img src={items[activeIndex].url} alt="" />
            ) : (
              <video
                src={items[activeIndex].url}
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
              {items[activeIndex].type === "VIDEO" ? (
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
              <button className="btn-ghost" type="button" onClick={close}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
