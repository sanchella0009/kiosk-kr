"use client";

import { useEffect, useRef, useState } from "react";
import { Keyboard } from "./Keyboard";

type Props = {
  campName: string;
};

export function ReviewForm({ campName }: Props) {
  const [rating, setRating] = useState(0);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [focusedField, setFocusedField] = useState<"name" | "message" | null>(
    null
  );
  const keyboardInteractRef = useRef(false);
  const blurTimeoutRef = useRef<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle"
  );

  const clearBlurTimeout = () => {
    if (blurTimeoutRef.current === null) return;
    window.clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = null;
  };

  const focusField = (field: "name" | "message" | null = focusedField) => {
    if (!field) return;
    window.requestAnimationFrame(() => {
      const target =
        field === "name" ? nameInputRef.current : messageInputRef.current;
      target?.focus({ preventScroll: true });
    });
  };

  const scheduleBlur = (field: "name" | "message") => {
    if (keyboardInteractRef.current) return;
    clearBlurTimeout();
    blurTimeoutRef.current = window.setTimeout(() => {
      setFocusedField((current) => (current === field ? null : current));
      blurTimeoutRef.current = null;
    }, 150);
  };

  useEffect(() => () => clearBlurTimeout(), []);

  const onSubmit = async () => {
    if (!message.trim() || rating === 0 || !name.trim()) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, name, message }),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("done");
      setRating(0);
      setName("");
      setMessage("");
      setFocusedField(null);
      setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const insertText = (text: string) => {
    if (focusedField === "name") {
      setName((prev) => prev + text);
    }
    if (focusedField === "message") {
      setMessage((prev) => prev + text);
    }
    focusField();
  };

  const backspace = () => {
    if (focusedField === "name") {
      setName((prev) => prev.slice(0, -1));
    }
    if (focusedField === "message") {
      setMessage((prev) => prev.slice(0, -1));
    }
    focusField();
  };

  return (
    <div className="review-form">
      <div className="stars">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className={`star ${rating >= value ? "active" : ""}`}
            onClick={() => setRating(value)}
          >
            ★
          </button>
        ))}
      </div>
      <input
        ref={nameInputRef}
        className="input"
        placeholder="Ваше имя"
        value={name}
        onFocus={() => {
          clearBlurTimeout();
          setFocusedField("name");
        }}
        onBlur={() => scheduleBlur("name")}
        onChange={(event) => setName(event.target.value)}
      />
      <textarea
        ref={messageInputRef}
        className="textarea"
        placeholder={`Что вам понравилось в ${campName}?`}
        value={message}
        onFocus={() => {
          clearBlurTimeout();
          setFocusedField("message");
        }}
        onBlur={() => scheduleBlur("message")}
        onChange={(event) => setMessage(event.target.value)}
      />
      <button className="btn-primary" type="button" onClick={onSubmit}>
        Отправить отзыв
      </button>
      {status === "sending" && <div>Отправка...</div>}
      {status === "done" && <div>Спасибо! Отзыв отправлен на модерацию.</div>}
      {status === "error" && <div>Ошибка отправки. Попробуйте позже.</div>}
      {!name.trim() || !message.trim() || rating === 0 ? (
        <div className="weather-sub">
          Укажите имя, поставьте звезды и напишите отзыв.
        </div>
      ) : null}
      {focusedField ? (
        <Keyboard
          onKeyPress={insertText}
          onBackspace={backspace}
          onSpace={() => insertText(" ")}
          onHide={() => {
            clearBlurTimeout();
            setFocusedField(null);
          }}
          onInteractStart={() => {
            clearBlurTimeout();
            keyboardInteractRef.current = true;
          }}
          onInteractEnd={() => {
            setTimeout(() => {
              keyboardInteractRef.current = false;
              focusField();
            }, 0);
          }}
        />
      ) : null}
    </div>
  );
}
