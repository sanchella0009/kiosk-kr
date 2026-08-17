"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  saveSquadAction,
  deleteSquadAction,
  addChildAction,
  addChildrenBatchAction,
  toggleChildLeftAction,
  deleteChildAction,
  setBestChildOfDayAction,
  saveCampLogoAction,
  updateSquadsOrderAction,
  toggleChildCommanderAction,
  addSquadPhotoAction,
  deleteSquadPhotoAction,
} from "@/app/actions/squads";

type Child = {
  id: string;
  name: string;
  isLeft: boolean;
  isCommander: boolean;
  bestDays: { id: string; date: Date }[];
};

type Squad = {
  id: string;
  name: string;
  photoUrl: string | null;
  photos: { id: string; url: string }[];
  children: Child[];
};

type Shift = {
  id: string;
  title: string | null;
  startDate: Date;
  endDate: Date;
};

type Props = {
  shift: Shift;
  shifts: Shift[];
  initialSquads: Squad[];
  initialLogoUrl: string | null;
};

export function SquadsAdmin({ shift, shifts, initialSquads, initialLogoUrl }: Props) {
  const router = useRouter();
  const [squads, setSquads] = useState<Squad[]>(initialSquads);
  const [campLogo, setCampLogo] = useState<string | null>(initialLogoUrl);

  useEffect(() => {
    setSquads(initialSquads);
  }, [initialSquads]);

  const moveSquad = async (index: number, direction: "up" | "down") => {
    const nextIndex = direction === "up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= squads.length) return;

    const newSquads = [...squads];
    const temp = newSquads[index];
    newSquads[index] = newSquads[nextIndex];
    newSquads[nextIndex] = temp;

    setSquads(newSquads);

    const squadIds = newSquads.map((s) => s.id);
    const res = await updateSquadsOrderAction(squadIds);
    if (!res.success) {
      alert("Ошибка при изменении порядка: " + res.error);
      router.refresh();
    } else {
      setMessage("Порядок отрядов изменен!");
      setTimeout(() => setMessage(null), 3000);
      router.refresh();
    }
  };

  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(
    initialSquads.length > 0 ? initialSquads[0].id : null
  );

  // Forms state
  const [newName, setNewName] = useState("");
  const [newPhotoUrl, setNewPhotoUrl] = useState<string | null>(null);
  const [editingSquadId, setEditingSquadId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);

  const [childName, setChildName] = useState("");
  const [batchText, setBatchText] = useState("");

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSquad, setUploadingSquad] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Helpers
  const selectedSquad = squads.find((s) => s.id === selectedSquadId);

  // Generate date list for this shift
  const getDates = () => {
    const dates: string[] = [];
    const current = new Date(shift.startDate);
    const end = new Date(shift.endDate);
    current.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    while (current <= end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const shiftDates = getDates();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/editor/upload-image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.url) {
        const actionRes = await saveCampLogoAction(data.url);
        if (actionRes.success) {
          setCampLogo(data.url);
          setMessage("Логотип лагеря обновлен!");
        } else {
          alert("Ошибка при сохранении в БД: " + actionRes.error);
        }
      }
    } catch {
      alert("Ошибка при загрузке логотипа");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSquadPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSquad(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/editor/upload-image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.url) {
        if (isEdit) {
          setEditPhotoUrl(data.url);
        } else {
          setNewPhotoUrl(data.url);
        }
      }
    } catch {
      alert("Ошибка при загрузке фото");
    } finally {
      setUploadingSquad(false);
    }
  };

  const handleAddSquad = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const res = await saveSquadAction(null, shift.id, newName, newPhotoUrl);
    if (res.success) {
      setNewName("");
      setNewPhotoUrl(null);
      setMessage("Отряд добавлен!");
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleSaveEditSquad = async () => {
    if (!editingSquadId || !editName.trim()) return;

    const res = await saveSquadAction(editingSquadId, shift.id, editName, editPhotoUrl);
    if (res.success) {
      setEditingSquadId(null);
      setMessage("Отряд обновлен!");
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleDeleteSquad = async (id: string) => {
    if (!confirm("Вы действительно хотите удалить этот отряд и всех детей в нем?")) return;

    const res = await deleteSquadAction(id);
    if (res.success) {
      if (selectedSquadId === id) {
        setSelectedSquadId(null);
      }
      setMessage("Отряд удален!");
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSquadId || !childName.trim()) return;

    const res = await addChildAction(selectedSquadId, childName);
    if (res.success) {
      setChildName("");
      setMessage("Ребенок добавлен!");
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleAddChildBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSquadId || !batchText.trim()) return;

    const res = await addChildrenBatchAction(selectedSquadId, batchText);
    if (res.success) {
      setBatchText("");
      setMessage("Список детей добавлен!");
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleToggleLeft = async (childId: string, currentIsLeft: boolean) => {
    const res = await toggleChildLeftAction(childId, !currentIsLeft);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleDeleteChild = async (childId: string) => {
    if (!confirm("Вы действительно хотите удалить ребенка из списка?")) return;

    const res = await deleteChildAction(childId);
    if (res.success) {
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleSetBestChild = async (dateStr: string, childId: string) => {
    if (!selectedSquadId) return;
    const res = await setBestChildOfDayAction(selectedSquadId, childId || null, dateStr);
    if (res.success) {
      setMessage(`Лучший ребенок дня на ${dateStr.split("-").reverse().slice(0, 2).join(".")} сохранен!`);
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleToggleCommander = async (childId: string, currentIsCommander: boolean) => {
    const nextVal = !currentIsCommander;
    
    // Optimistic UI update
    setSquads(prevSquads => prevSquads.map(s => {
      return {
        ...s,
        children: s.children.map(c => {
          if (c.id === childId) {
            return { ...c, isCommander: nextVal };
          }
          return c;
        })
      };
    }));

    const res = await toggleChildCommanderAction(childId, nextVal);
    if (!res.success) {
      alert("Ошибка при изменении статуса командира: " + res.error);
      router.refresh();
    } else {
      router.refresh();
    }
  };

  const [uploadingGallery, setUploadingGallery] = useState(false);

  const handleSquadPhotoGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSquadId) return;

    setUploadingGallery(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/editor/upload-image", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.url) {
        const actionRes = await addSquadPhotoAction(selectedSquadId, data.url);
        if (actionRes.success) {
          setMessage("Фото добавлено в галерею отряда!");
          setTimeout(() => setMessage(null), 3000);
          router.refresh();
        } else {
          alert("Ошибка при сохранении фото в БД: " + actionRes.error);
        }
      }
    } catch {
      alert("Ошибка при загрузке фото");
    } finally {
      setUploadingGallery(false);
    }
  };

  const handleDeleteSquadPhoto = async (photoId: string) => {
    if (!confirm("Вы действительно хотите удалить это фото из галереи?")) return;

    const res = await deleteSquadPhotoAction(photoId);
    if (res.success) {
      setMessage("Фото удалено из галереи!");
      setTimeout(() => setMessage(null), 3000);
      router.refresh();
    } else {
      alert("Ошибка при удалении фото: " + res.error);
    }
  };

  return (
    <div className="list" style={{ gap: 20 }}>
      {/* Shift Selector and Camp Logo Upload */}
      <div className="admin-card" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "center" }}>
        <div>
          <h2>Выбор смены</h2>
          <select
            className="input"
            style={{ marginTop: 8, padding: "8px 12px", width: "100%", maxWidth: 350 }}
            value={shift.id}
            onChange={(e) => router.push(`/adm/squads?shiftId=${e.target.value}`)}
          >
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || "Без названия"} ({new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        <div style={{ borderLeft: "1px solid #f3d6a0", paddingLeft: 24, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 12,
            background: "#f0e4cc",
            border: "2px solid #e86a33",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          }}>
            {campLogo ? (
              <img src={campLogo} alt="Логотип" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: 12, color: "var(--ink-muted)", textAlign: "center" }}>Нет лого</span>
            )}
          </div>
          <div>
            <h3>Логотип лагеря</h3>
            <label className="btn-ghost" style={{ display: "inline-block", marginTop: 8, cursor: "pointer", fontSize: 13, padding: "6px 12px" }}>
              {uploadingLogo ? "Загрузка..." : "Загрузить логотип"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoUpload} disabled={uploadingLogo} />
            </label>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "start" }}>
        {/* Squads Management column */}
        <div className="admin-card">
          <h2>Отряды ({squads.length})</h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
            {squads.map((squad) => {
              const isSelected = squad.id === selectedSquadId;
              const isEditing = squad.id === editingSquadId;

              return (
                <div
                  key={squad.id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: isSelected ? "2px solid #e86a33" : "1px solid #f3d6a0",
                    background: isSelected ? "#fffbf4" : "#fff",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8
                  }}
                  onClick={() => !isEditing && setSelectedSquadId(squad.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      background: "#f0e4cc",
                      overflow: "hidden",
                      flexShrink: 0
                    }}>
                      {squad.photoUrl ? (
                        <img src={squad.photoUrl} alt={squad.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontSize: 18 }}>👥</div>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      {isEditing ? (
                        <input
                          className="input"
                          style={{ padding: "4px 8px", fontSize: 14 }}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <div style={{ fontWeight: 700 }}>{squad.name}</div>
                      )}
                      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 2 }}>
                        Детей: {squad.children.length} (выбыло: {squad.children.filter((c) => c.isLeft).length})
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: "2px 6px", fontSize: 11, minWidth: 24, lineHeight: 1 }}
                        disabled={squads.indexOf(squad) === 0}
                        onClick={() => moveSquad(squads.indexOf(squad), "up")}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ padding: "2px 6px", fontSize: 11, minWidth: 24, lineHeight: 1 }}
                        disabled={squads.indexOf(squad) === squads.length - 1}
                        onClick={() => moveSquad(squads.indexOf(squad), "down")}
                      >
                        ▼
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <div style={{ width: 36, height: 36, borderRadius: 4, background: "#eee", overflow: "hidden" }}>
                          {editPhotoUrl && <img src={editPhotoUrl} alt="Превью" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        <label className="btn-ghost" style={{ fontSize: 12, padding: "4px 8px", cursor: "pointer" }}>
                          Выбрать фото
                          <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleSquadPhotoUpload(e, true)} />
                        </label>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-primary" style={{ padding: "4px 8px", fontSize: 12 }} onClick={handleSaveEditSquad}>Сохранить</button>
                        <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: 12, borderColor: "#b1462b", color: "#b1462b" }} onClick={() => setEditingSquadId(null)}>Отмена</button>
                      </div>
                    </div>
                  )}

                  {!isEditing && (
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 11, padding: "2px 8px" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingSquadId(squad.id);
                          setEditName(squad.name);
                          setEditPhotoUrl(squad.photoUrl);
                        }}
                      >
                        Редактировать
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 11, padding: "2px 8px", borderColor: "#b1462b", color: "#b1462b" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSquad(squad.id);
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleAddSquad} style={{ marginTop: 24, padding: 12, border: "2px dashed #f3d6a0", borderRadius: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <h4 style={{ fontWeight: 600 }}>Добавить отряд</h4>
            <input
              className="input"
              placeholder="Название (например: 1 отряд)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 6, background: "#fff", border: "1px solid #ddd", overflow: "hidden", display: "grid", placeItems: "center" }}>
                {newPhotoUrl ? (
                  <img src={newPhotoUrl} alt="Превью" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 20 }}>🖼️</span>
                )}
              </div>
              <label className="btn-ghost" style={{ fontSize: 13, padding: "6px 12px", cursor: "pointer" }}>
                {uploadingSquad ? "Загрузка..." : "Загрузить фото"}
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleSquadPhotoUpload(e, false)} disabled={uploadingSquad} />
              </label>
            </div>
            <button className="btn-primary" type="submit" style={{ width: "100%" }} disabled={!newName.trim() || uploadingSquad}>
              Создать отряд
            </button>
          </form>
        </div>

        {/* Selected Squad Details (Children and Best child calendar) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {selectedSquad ? (
            <>
              {/* Children Roster */}
              <div className="admin-card">
                <h2>Список детей отряда: <span style={{ color: "var(--accent)" }}>{selectedSquad.name}</span></h2>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                  {/* Single Child Form */}
                  <form onSubmit={handleAddChild} className="review-form" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, background: "var(--bg-deep)", borderRadius: 12 }}>
                    <h4 style={{ fontWeight: 600 }}>По одному</h4>
                    <input
                      className="input"
                      placeholder="ФИО ребенка"
                      value={childName}
                      onChange={(e) => setChildName(e.target.value)}
                    />
                    <button className="btn-primary" type="submit" style={{ alignSelf: "flex-start", padding: "6px 12px", fontSize: 13 }}>
                      Добавить
                    </button>
                  </form>

                  {/* Batch Add Form */}
                  <form onSubmit={handleAddChildBatch} className="review-form" style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, background: "var(--bg-deep)", borderRadius: 12 }}>
                    <h4 style={{ fontWeight: 600 }}>Списком (каждый с новой строки)</h4>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Иванов Иван&#10;Петров Петр"
                      value={batchText}
                      onChange={(e) => setBatchText(e.target.value)}
                      style={{ resize: "vertical", fontFamily: "inherit" }}
                    />
                    <button className="btn-primary" type="submit" style={{ alignSelf: "flex-start", padding: "6px 12px", fontSize: 13 }}>
                      Импортировать список
                    </button>
                  </form>
                </div>

                {/* Children Table */}
                <div style={{ marginTop: 20, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #f3d6a0", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px" }}>Имя</th>
                        <th style={{ padding: "8px 12px", width: 120 }}>Командир</th>
                        <th style={{ padding: "8px 12px", width: 120 }}>Выбыл</th>
                        <th style={{ padding: "8px 12px", width: 100, textAlign: "right" }}>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSquad.children.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: 16, textAlign: "center", color: "var(--ink-muted)", fontStyle: "italic" }}>
                            В этом отряде пока нет детей.
                          </td>
                        </tr>
                      ) : (
                        selectedSquad.children.map((child) => (
                          <tr key={child.id} style={{ borderBottom: "1px solid #f3d6a0", opacity: child.isLeft ? 0.5 : 1 }}>
                            <td style={{ padding: "8px 12px", textDecoration: child.isLeft ? "line-through" : "none" }}>
                              {child.name} {child.isCommander && <span style={{ fontSize: 11, color: "#1f5f2c", fontWeight: 700, marginLeft: 6, padding: "2px 6px", background: "#cfe8d0", borderRadius: 4 }}>👑 Командир</span>}
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              <input
                                type="checkbox"
                                checked={child.isCommander}
                                onChange={() => handleToggleCommander(child.id, child.isCommander)}
                                style={{ width: 18, height: 18, cursor: "pointer" }}
                                disabled={child.isLeft}
                              />
                            </td>
                            <td style={{ padding: "8px 12px" }}>
                              <input
                                type="checkbox"
                                checked={child.isLeft}
                                onChange={() => handleToggleLeft(child.id, child.isLeft)}
                                style={{ width: 18, height: 18, cursor: "pointer" }}
                              />
                            </td>
                            <td style={{ padding: "8px 12px", textAlign: "right" }}>
                              <button
                                className="btn-ghost"
                                style={{ padding: "4px 8px", fontSize: 12, borderColor: "#b1462b", color: "#b1462b" }}
                                onClick={() => handleDeleteChild(child.id)}
                              >
                                Удалить
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Best Child of the Day Calendar */}
              <div className="admin-card">
                <h2>Лучший ребенок отряда по дням смены</h2>
                <p style={{ color: "var(--ink-muted)", fontSize: 13, marginTop: 4 }}>
                  Установите лучшего ребенка на каждый день смены. В таблице на киоске напротив его имени отобразится логотип лагеря.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
                  {shiftDates.map((dateStr) => {
                    // Find if there is a child in this squad that is best child on this date
                    const activeBestDay = selectedSquad.children.find((c) =>
                      c.bestDays.some((d) => new Date(d.date).toISOString().slice(0, 10) === dateStr)
                    );

                    const formattedDate = dateStr.split("-").reverse().slice(0, 2).join(".");

                    return (
                      <div key={dateStr} style={{ padding: 10, border: "1px solid #f3d6a0", borderRadius: 8, background: "#fff" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>📅 {formattedDate}</div>
                        <select
                          className="input"
                          style={{ padding: "4px 8px", fontSize: 13, marginTop: 6, width: "100%" }}
                          value={activeBestDay?.id || ""}
                          onChange={(e) => handleSetBestChild(dateStr, e.target.value)}
                        >
                          <option value="">-- Выбрать ребенка --</option>
                          {selectedSquad.children
                            .filter((c) => !c.isLeft)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Squad Photo Gallery */}
              <div className="admin-card">
                <h2>📸 Галерея отряда (дополнительные фото)</h2>
                <p style={{ color: "var(--ink-muted)", fontSize: 13, marginTop: 4 }}>
                  Загрузите дополнительные фотографии отряда. Они будут показываться на главном экране в виде листалки.
                </p>

                {/* Upload Trigger */}
                <div style={{ marginTop: 16 }}>
                  <label className="btn" style={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: 8, 
                    backgroundColor: "var(--accent-2, #3e6344)", 
                    color: "#fff", 
                    padding: "10px 16px", 
                    borderRadius: 6, 
                    cursor: uploadingGallery ? "not-allowed" : "pointer",
                    fontSize: 13,
                    fontWeight: 600
                  }}>
                    {uploadingGallery ? "⏳ Загрузка..." : "➕ Добавить фото в галерею"}
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: "none" }} 
                      onChange={handleSquadPhotoGalleryUpload} 
                      disabled={uploadingGallery} 
                    />
                  </label>
                </div>

                {/* Gallery Grid */}
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", 
                  gap: 16, 
                  marginTop: 20 
                }}>
                  {(!selectedSquad.photos || selectedSquad.photos.length === 0) ? (
                    <div style={{ gridColumn: "1 / -1", fontStyle: "italic", color: "var(--ink-muted)", padding: 12 }}>
                      Галерея пока пуста. Загрузите первые фотографии!
                    </div>
                  ) : (
                    selectedSquad.photos.map((photo) => (
                      <div 
                        key={photo.id} 
                        style={{ 
                          position: "relative", 
                          height: 120, 
                          borderRadius: 8, 
                          overflow: "hidden", 
                          border: "1px solid #f3d6a0"
                        }}
                      >
                        <img 
                          src={photo.url} 
                          alt="Фото" 
                          style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteSquadPhoto(photo.id)}
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            backgroundColor: "rgba(177, 70, 43, 0.9)",
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            padding: "4px 8px",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.3)"
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="admin-card" style={{ textAlign: "center", color: "var(--ink-muted)", padding: 40 }}>
              Выберите отряд слева или создайте новый, чтобы редактировать список детей.
            </div>
          )}
        </div>
      </div>

      {message && (
        <div style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: "#1f5f2c",
          color: "#fff",
          padding: "12px 24px",
          borderRadius: 8,
          fontWeight: 600,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          zIndex: 1000
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
