"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  endpoint: string;
  mode: "main" | "menu" | "schedule";
};

export function MediaUploadForm({ endpoint, mode }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const files =
      formData.getAll("file").filter((f) => f instanceof File) as File[];
    const dateFor = String(formData.get("dateFor") ?? "");
    if (files.length) {
      handleFiles(files, dateFor);
    } else {
      setError("Выберите файлы");
    }
  };

  const handleFiles = (files: File[], dateFor?: string) => {
    const upload = async () => {
      setError(null);
      setNotice(null);
      setSuccess(null);
      setLoading(true);
      setProgress(0);
      try {
        if (mode === "main" && files.length === 0) {
          setError("Выберите файлы");
          return;
        }
        if (mode !== "main" && !dateFor) {
          setError("Выберите дату");
          return;
        }
        if (mode === "main" && files.length > 1) {
          setTotal(files.length);
          for (let i = 0; i < files.length; i += 1) {
            setCurrent(i + 1);
            const fd = new FormData();
            fd.append("file", files[i]);
            await uploadWithProgress(endpoint, fd, setProgress);
          }
        } else {
          setTotal(1);
          setCurrent(1);
          const fd = new FormData();
          fd.append("file", files[0]);
          if (dateFor) fd.append("dateFor", dateFor);
          await uploadWithProgress(endpoint, fd, setProgress);
        }
        setError(null);
        setNotice(null);
        setSuccess("Загружено");
        router.refresh();
      } catch {
        setNotice("Проверьте список — файл мог загрузиться");
        router.refresh();
      } finally {
        setLoading(false);
      }
    };
    void upload();
  };

  return (
    <form
      onSubmit={onSubmit}
      className={`review-form dropzone ${isDragging ? "drag" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length) {
          handleFiles(files);
        }
      }}
      onPaste={(event) => {
        const items = Array.from(event.clipboardData.files);
        if (items.length) {
          handleFiles(items);
        }
      }}
    >
      {mode === "main" ? (
        <>
          <input
            className="input"
            type="file"
            name="file"
            accept="image/*,video/*"
            multiple
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length) handleFiles(files);
            }}
          />
        </>
      ) : (
        <>
          <input className="input" type="date" name="dateFor" required />
          <input
            className="input"
            type="file"
            name="file"
            accept="image/*"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              const form = event.currentTarget.form;
              const dateFor =
                form && form.elements.namedItem("dateFor")
                  ? (form.elements.namedItem("dateFor") as HTMLInputElement).value
                  : "";
              if (files.length) handleFiles(files, dateFor);
            }}
          />
        </>
      )}
      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? "Загрузка..." : "Загрузить"}
      </button>
      {loading && total > 0 ? (
        <div className="upload-progress">
          <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
          <div className="upload-progress-text">
            {current}/{total} · {progress}%
          </div>
        </div>
      ) : null}
      {error ? <div style={{ color: "#b1462b" }}>{error}</div> : null}
      {notice && !success ? (
        <div style={{ color: "var(--ink-muted)" }}>{notice}</div>
      ) : null}
      {success ? <div style={{ color: "var(--accent-2)" }}>{success}</div> : null}
    </form>
  );
}

const uploadWithProgress = (
  endpoint: string,
  formData: FormData,
  onProgress: (value: number) => void
) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error(`Upload failed: ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(formData);
  });
