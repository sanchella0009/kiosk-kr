import { requireAdmin } from "@/lib/auth";
import { AdminScrollMode } from "@/components/admin/AdminScrollMode";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireAdmin();

  return (
    <>
      <AdminScrollMode />
      <div className="admin-layout">
        <AdminSidebar username={user.username} />
        <main className="admin-main">{children}</main>
      </div>
    </>
  );
}

