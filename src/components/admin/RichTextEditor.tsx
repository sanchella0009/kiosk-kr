"use client";

import { useEffect, useRef } from "react";

type Props = {
  value: string;
  onChange: (html: string) => void;
};

export function RichTextEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastValue = useRef<string>(value);
  const isEditing = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = value;
    lastValue.current = value;
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    if (isEditing.current) return;
    if (lastValue.current === value) return;
    ref.current.innerHTML = value;
    lastValue.current = value;
  }, [value]);

  const exec = (command: string, arg?: string) => {
    document.execCommand(command, false, arg);
    if (ref.current) {
      const html = ref.current.innerHTML;
      lastValue.current = html;
      onChange(html);
    }
  };

  const onInput = () => {
    if (ref.current) {
      const html = ref.current.innerHTML;
      lastValue.current = html;
      onChange(html);
    }
  };

  const onUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/editor/upload-image", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { url?: string };
    if (data.url) {
      exec("insertImage", data.url);
    }
  };

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <button type="button" onClick={() => exec("bold")}>
          Жирный
        </button>
        <button type="button" onClick={() => exec("italic")}>
          Курсив
        </button>
        <button type="button" onClick={() => exec("underline")}>
          Подчеркнутый
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Ссылка") || "";
            if (url) exec("createLink", url);
          }}
        >
          Ссылка
        </button>
        <label className="editor-upload">
          Картинка
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      <div
        ref={ref}
        className="editor-area"
        contentEditable
        onInput={onInput}
        onFocus={() => {
          isEditing.current = true;
        }}
        onBlur={() => {
          isEditing.current = false;
        }}
        suppressContentEditableWarning
      />
    </div>
  );
}
