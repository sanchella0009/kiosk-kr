"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  saveEventAction,
  deleteEventAction,
  setSquadOfDayAction,
  removeSquadOfDayAction,
  saveSquadPenaltyRewardAction,
  deleteSquadPenaltyRewardAction,
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

type SquadPenaltyReward = {
  id: string;
  squadId: string;
  type: "PENALTY" | "REWARD";
  points: number;
  reason: string;
  date: Date;
};

type Props = {
  shift: Shift;
  shifts: Shift[];
  squads: Squad[];
  events: Event[];
  squadOfDays: SquadOfDay[];
  penaltiesRewards: SquadPenaltyReward[];
};

export function RatingsAdmin({ shift, shifts, squads, events, squadOfDays, penaltiesRewards }: Props) {
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

  // Penalties & Rewards state
  const [penSquadId, setPenSquadId] = useState(squads[0]?.id || "");
  const [penType, setPenType] = useState<"PENALTY" | "REWARD">("REWARD");
  const [penPoints, setPenPoints] = useState(1);
  const [penReason, setPenReason] = useState("");
  const [penDate, setPenDate] = useState(shiftDates[0] || "");

  // Sync state if selected shift/squads change
  useEffect(() => {
    if (squads.length > 0 && !squads.some((s) => s.id === penSquadId)) {
      setPenSquadId(squads[0].id);
    } else if (squads.length > 0 && !penSquadId) {
      setPenSquadId(squads[0].id);
    }
    if (shiftDates.length > 0 && !shiftDates.includes(penDate)) {
      setPenDate(shiftDates[0]);
    } else if (shiftDates.length > 0 && !penDate) {
      setPenDate(shiftDates[0]);
    }
  }, [shift.id, squads, shiftDates, penSquadId, penDate]);

  const handleSavePenaltyReward = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSquadId = penSquadId || squads[0]?.id;
    const targetDate = penDate || shiftDates[0];
    if (!targetSquadId) {
      alert("Выберите отряд");
      return;
    }
    if (!targetDate) {
      alert("Выберите дату");
      return;
    }
    if (!penReason.trim()) {
      alert("Укажите причину");
      return;
    }

    const res = await saveSquadPenaltyRewardAction(targetSquadId, penType, penPoints, penReason, targetDate);
    if (res.success) {
      setPenReason("");
      setMessage(penType === "REWARD" ? "Поощрение успешно добавлено!" : "Штраф успешно добавлен!");
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  const handleDeletePenaltyReward = async (id: string) => {
    if (!confirm("Вы действительно хотите удалить эту запись?")) return;
    const res = await deleteSquadPenaltyRewardAction(id);
    if (res.success) {
      setMessage("Запись удалена!");
      router.refresh();
    } else {
      alert(res.error);
    }
  };

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
                        const isSquadOfDay = !!activeSquadOfDay;

                        return (
                          <div key={squad.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <span style={{ fontWeight: 600, fontSize: 14 }}>{squad.name}</span>
                            <button
                              type="button"
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 22,
                                padding: 2,
                                lineHeight: 1,
                                filter: isSquadOfDay ? "none" : "grayscale(100%) opacity(25%)",
                                transition: "transform 0.1s"
                              }}
                              onClick={() => handleStarChange(squad.id, dateStr, isSquadOfDay ? 0 : 1)}
                              title={isSquadOfDay ? "Снять отметку отряда дня" : "Отметить как отряд дня"}
                            >
                              ⭐
                            </button>
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

      {/* Penalties & Rewards Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: 24, marginTop: 24, alignItems: "start" }}>
        {/* Form Column */}
        <div className="admin-card">
          <h2>⚖️ Начислить штраф / поощрение</h2>
          <form onSubmit={handleSavePenaltyReward} className="review-form" style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <div>
              <label style={{ fontSize: 14, fontWeight: 700 }}>Отряд:</label>
              <select
                className="input"
                style={{ marginTop: 4, width: "100%" }}
                value={penSquadId}
                onChange={(e) => setPenSquadId(e.target.value)}
                required
              >
                {squads.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                {squads.length === 0 && <option value="">Отряды не созданы</option>}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 700 }}>Тип действия:</label>
                <select
                  className="input"
                  style={{ marginTop: 4, width: "100%" }}
                  value={penType}
                  onChange={(e) => setPenType(e.target.value as "PENALTY" | "REWARD")}
                  required
                >
                  <option value="REWARD">Поощрение (+)</option>
                  <option value="PENALTY">Штраф (-)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 14, fontWeight: 700 }}>Количество баллов:</label>
                <select
                  className="input"
                  style={{ marginTop: 4, width: "100%" }}
                  value={penPoints}
                  onChange={(e) => setPenPoints(Number(e.target.value))}
                  required
                >
                  {[1, 2, 3, 4, 5].map((pts) => (
                    <option key={pts} value={pts}>
                      {pts} {pts === 1 ? "балл" : pts < 5 ? "балла" : "баллов"}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 700 }}>Дата:</label>
                <select
                  className="input"
                  style={{ marginTop: 4, width: "100%" }}
                  value={penDate}
                  onChange={(e) => setPenDate(e.target.value)}
                  required
                >
                  {shiftDates.map((dateStr) => {
                    const formattedDate = dateStr.split("-").reverse().slice(0, 2).join(".");
                    return (
                      <option key={dateStr} value={dateStr}>
                        📅 {formattedDate}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 14, fontWeight: 700 }}>Причина / Описание:</label>
              <input
                className="input"
                placeholder="Например: За образцовый порядок в палате"
                value={penReason}
                onChange={(e) => setPenReason(e.target.value)}
                required
                style={{ marginTop: 4 }}
              />
            </div>

            <div style={{ marginTop: 6 }}>
              <button className="btn-primary" type="submit" disabled={squads.length === 0}>
                Начислить
              </button>
            </div>
          </form>
        </div>

        {/* List Column */}
        <div className="admin-card">
          <h2>📜 История штрафов и поощрений ({penaltiesRewards.length})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {penaltiesRewards.length === 0 ? (
              <div style={{ fontStyle: "italic", color: "var(--ink-muted)", padding: 8 }}>
                Штрафы и поощрения пока не начислялись.
              </div>
            ) : (
              penaltiesRewards.map((item) => {
                const sq = squads.find((s) => s.id === item.squadId);
                if (!sq) return null;
                const formattedDate = new Date(item.date).toLocaleDateString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                });
                const isReward = item.type === "REWARD";

                return (
                  <div
                    key={item.id}
                    style={{
                      padding: 12,
                      border: "1px solid #f3d6a0",
                      borderRadius: 10,
                      background: "#fff",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>
                          📅 {formattedDate}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: 15, background: "var(--bg-deep)", padding: "2px 8px", borderRadius: 6 }}>
                          {sq.name}
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: 13,
                            color: isReward ? "#1f5f2c" : "#b1462b",
                            background: isReward ? "#cfe8d0" : "#fbdad2",
                            padding: "2px 8px",
                            borderRadius: 6,
                          }}
                        >
                          {isReward ? `+${item.points} б.` : `-${item.points} б.`}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, color: "var(--ink-main)", marginTop: 2 }}>
                        {item.reason}
                      </div>
                    </div>
                    <div>
                      <button
                        className="btn-ghost"
                        style={{
                          padding: "6px 12px",
                          fontSize: 12,
                          borderColor: "#b1462b",
                          color: "#b1462b",
                        }}
                        onClick={() => handleDeletePenaltyReward(item.id)}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
