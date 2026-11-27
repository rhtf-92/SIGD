import { useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import AdminHeader from "../components/administracion/layout/AdminHeader";
import AdminSidebar from "../components/administracion/layout/AdminSidebar";
import AdminFooter from "../components/administracion/layout/AdminFooter";

interface AdminLayoutProps {
  children?: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="admin-layout-sigd flex min-h-screen flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <AdminHeader
        sidebarOpen={mobileSidebarOpen}
        onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
      />

      <div className="flex min-h-[calc(100vh-4rem)] flex-1">
        <AdminSidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <div className="flex h-full flex-1 flex-col min-w-0 min-h-0">
          <main className="flex-1 min-w-0 w-full overflow-y-auto">
            {children ?? <Outlet />}
          </main>

          <AdminFooter />
        </div>
      </div>
    </div>
  );
}
