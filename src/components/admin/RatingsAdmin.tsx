"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveEventAction,
  deleteEventAction,
  setSquadOfDayAction,
  removeSquadOfDayAction,
} from "@/app/actions/squads";

type Squad = {
  id: string;
  name: string;
  photoUrl: string | null;
};

type EventPlace = {
  squadId: string;
  place: number;
};

type Event = {
  id: string;
  name: string;
  places: EventPlace[];
};

type SquadOfDay = {
  id: string;
  squadId: string;
  date: Date;
  stars: number;
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
  squads: Squad[];
  events: Event[];
  squadOfDays: SquadOfDay[];
};

export function RatingsAdmin({ shift, shifts, squads, events, squadOfDays }: Props) {
  const router = useRouter();

  // Events editing state
  const [eventName, setEventName] = useState("");
  const [eventPlaces, setEventPlaces] = useState<Record<string, number>>({});
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);

  // Generate list of dates for this shift
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

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim()) return;

    const placesPayload = Object.entries(eventPlaces)
      .filter(([_, place]) => place > 0)
      .map(([squadId, place]) => ({ squadId, place }));

    const res = await saveEventAction(editingEventId, eventName, placesPayload);
    if (res.success) {
      setEventName("");
      setEventPlaces({});
      setEditingEventId(null);
      setMessage(editingEventId ? "Мероприятие обновлено!" : "Мероприятие добавлено!");
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleEditEvent = (evt: Event) => {
    setEditingEventId(evt.id);
    setEventName(evt.name);
    const placesMap: Record<string, number> = {};
    evt.places.forEach((p) => {
      placesMap[p.squadId] = p.place;
    });
    setEventPlaces(placesMap);
  };

  const handleDeleteEvent = async (id: string) => {
    if (!confirm("Вы действительно хотите удалить это мероприятие?")) return;

    const res = await deleteEventAction(id);
    if (res.success) {
      setMessage("Мероприятие удалено!");
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleStarChange = async (squadId: string, dateStr: string, stars: number) => {
    if (stars === 0) {
      const res = await removeSquadOfDayAction(squadId, dateStr);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error);
      }
    } else {
      const res = await setSquadOfDayAction(squadId, dateStr, stars);
      if (res.success) {
        router.refresh();
      } else {
        alert(res.error);
      }
    }
  };

  return (
    <div className="list" style={{ gap: 20 }}>
      {/* Shift Selector */}
      <div className="admin-card">
        <h2>Выбор смены</h2>
        <select
          className="input"
          style={{ marginTop: 8, padding: "8px 12px", width: "100%", maxWidth: 350 }}
          value={shift.id}
          onChange={(e) => router.push(`/adm/ratings?shiftId=${e.target.value}`)}
        >
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title || "Без названия"} ({new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()})
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 24, alignItems: "start" }}>
        {/* Events list and ratings form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Add / Edit Event form */}
          <div className="admin-card">
            <h2>{editingEventId ? "📝 Редактировать мероприятие" : "🏆 Создать мероприятие"}</h2>
            <form onSubmit={handleSaveEvent} className="review-form" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 700 }}>Название мероприятия:</label>
                <input
                  className="input"
                  placeholder="Например: Открытие смены, Веселые старты"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  required
                  style={{ marginTop: 4 }}
                />
              </div>

              {squads.length === 0 ? (
                <div style={{ fontStyle: "italic", color: "var(--ink-muted)", fontSize: 13 }}>
                  В смене нет отрядов. Сначала добавьте отряды в разделе "Отряды и дети".
                </div>
              ) : (
                <div>
                  <label style={{ fontSize: 14, fontWeight: 700 }}>Места отрядов за это мероприятие:</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
                    {squads.map((squad) => (
                      <div key={squad.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "6px 10px", background: "var(--bg-deep)", borderRadius: 8 }}>
                        <span style={{ fontWeight: 600 }}>{squad.name}</span>
                        <select
                          className="input"
                          style={{ padding: "4px 8px", width: 140 }}
                          value={eventPlaces[squad.id] || ""}
                          onChange={(e) =>
                            setEventPlaces((prev) => ({
                              ...prev,
                              [squad.id]: Number(e.target.value),
                            }))
                          }
                        >
                          <option value="0">Без места</option>
                          <option value="1">1 место (3 б.)</option>
                          <option value="2">2 место (2 б.)</option>
                          <option value="3">3 место (1 б.)</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button className="btn-primary" type="submit" disabled={squads.length === 0}>
                  {editingEventId ? "Сохранить изменения" : "Создать мероприятие"}
                </button>
                {editingEventId && (
                  <button
                    className="btn-ghost"
                    type="button"
                    style={{ borderColor: "#b1462b", color: "#b1462b" }}
                    onClick={() => {
                      setEditingEventId(null);
                      setEventName("");
                      setEventPlaces({});
                    }}
                  >
                    Отмена
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Events List */}
          <div className="admin-card">
            <h2>Список мероприятий ({events.length})</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {events.length === 0 ? (
                <div style={{ fontStyle: "italic", color: "var(--ink-muted)", padding: 8 }}>
                  Мероприятия пока не созданы.
                </div>
              ) : (
                events.map((evt) => (
                  <div key={evt.id} style={{ padding: 12, border: "1px solid #f3d6a0", borderRadius: 10, background: "#fff", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{evt.name}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => handleEditEvent(evt)}>
                          Редактировать
                        </button>
                        <button className="btn-ghost" style={{ padding: "4px 8px", fontSize: 12, borderColor: "#b1462b", color: "#b1462b" }} onClick={() => handleDeleteEvent(evt.id)}>
                          Удалить
                        </button>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
                      {evt.places.map((p) => {
                        const sq = squads.find((s) => s.id === p.squadId);
                        if (!sq) return null;
                        const pointsMap: Record<number, string> = { 1: "🥇 1 место (3 б.)", 2: "🥈 2 место (2 б.)", 3: "🥉 3 место (1 б.)" };
                        return (
                          <span key={p.squadId} style={{ background: "var(--bg-deep)", padding: "2px 8px", borderRadius: 6 }}>
                            <strong>{sq.name}</strong>: {pointsMap[p.place] || `${p.place} место`}
                          </span>
                        );
                      })}
                      {evt.places.length === 0 && <span style={{ color: "var(--ink-muted)", fontStyle: "italic" }}>Места не распределены</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Squad of the Day column */}
        <div className="admin-card">
          <h2>⭐ Отряд дня</h2>
          <p style={{ color: "var(--ink-muted)", fontSize: 13, marginTop: 4 }}>
            Отмечайте лучшие отряды дня. Выберите количество звезд для каждого отряда на конкретную дату смены.
          </p>

          {squads.length === 0 ? (
            <div style={{ fontStyle: "italic", color: "var(--ink-muted)", padding: 16, textAlign: "center", marginTop: 16 }}>
              Добавьте отряды, чтобы иметь возможность выбирать отряд дня.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
              {shiftDates.map((dateStr) => {
                const formattedDate = dateStr.split("-").reverse().slice(0, 2).join(".");

                return (
                  <div key={dateStr} style={{ padding: 14, border: "1px solid #f3d6a0", borderRadius: 12, background: "#fff" }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--accent)", borderBottom: "1px solid #f9ebd2", paddingBottom: 6, marginBottom: 10 }}>
                      📅 {formattedDate}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {squads.map((squad) => {
                        const activeSquadOfDay = squadOfDays.find((sod) =>
                          sod.squadId === squad.id &&
                          new Date(sod.date).toISOString().slice(0, 10) === dateStr
                        );
                        const currentStars = activeSquadOfDay?.stars || 0;

                        return (
                          <div key={squad.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{squad.name}</span>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  style={{
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    fontSize: 20,
                                    padding: 2,
                                    lineHeight: 1,
                                    filter: star <= currentStars ? "none" : "grayscale(100%) opacity(30%)"
                                  }}
                                  onClick={() => handleStarChange(squad.id, dateStr, star === currentStars ? 0 : star)}
                                >
                                  ⭐
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
