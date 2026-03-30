"use client";

import { useState } from "react";

type Props = {
  initialError?: boolean;
};

export function AdminLoginForm({ initialError }: Props) {
  const [error, setError] = useState(Boolean(initialError));
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(false);
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      if (!res.ok) {
        setError(true);
        return;
      }
      window.location.href = "/adm";
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="review-form">
      <input
        className="input"
        name="username"
        placeholder="Логин"
        autoComplete="username"
      />
      <input
        className="input"
        type="password"
        name="password"
        placeholder="Пароль"
        autoComplete="current-password"
      />
      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? "Входим..." : "Войти"}
      </button>
      {error ? (
        <p style={{ marginTop: 12, color: "#b1462b" }}>
          Неверный логин или пароль
        </p>
      ) : null}
    </form>
  );
}
