"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/admin/RichTextEditor";

type Props = {
  initial?: { id?: string; title: string; slug: string; content: string };
};

export function SectionForm({ initial }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        initial?.id ? `/api/sections/${initial.id}` : "/api/sections",
        {
          method: initial?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, slug, content }),
          credentials: "same-origin",
        }
      );
      if (!res.ok) {
        setError("Не удалось сохранить");
        return;
      }
      router.refresh();
    } catch {
      setError("Ошибка сохранения");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="review-form">
      <input
        className="input"
        placeholder="Заголовок"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <input
        className="input"
        placeholder="slug (unikalno)"
        value={slug}
        onChange={(event) => setSlug(event.target.value)}
      />
      <RichTextEditor value={content} onChange={setContent} />
      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? "Сохраняю..." : initial?.id ? "Сохранить" : "Добавить"}
      </button>
      {error ? <div style={{ color: "#b1462b" }}>{error}</div> : null}
    </form>
  );
}
