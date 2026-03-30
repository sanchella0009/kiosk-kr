import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AdminLoginForm } from "@/components/AdminLoginForm";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const user = await getSessionUser();
  if (user) {
    redirect("/adm");
  }

  const errorParam = searchParams?.error;
  const hasError = Array.isArray(errorParam)
    ? errorParam.includes("1")
    : errorParam === "1";

  return (
    <main className="page" style={{ gridTemplateColumns: "1fr" }}>
      <div className="card" style={{ maxWidth: 520, margin: "0 auto" }}>
        <div className="section-block">
          <h1>Вход в админку</h1>
          <AdminLoginForm initialError={hasError} />
          <p style={{ marginTop: 12, color: "var(--ink-muted)" }}>
            Первый администратор создается через скрипт seed.
          </p>
        </div>
      </div>
    </main>
  );
}
