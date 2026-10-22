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
    <div className="min-h-screen bg-[#070d1a] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Ambient background glows */}
      <div
        className="fixed top-0 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[130px] pointer-events-none z-0"
        aria-hidden="true"
      />
      <div
        className="fixed top-1/3 right-10 w-[450px] h-[450px] bg-cyan-500/8 rounded-full blur-[120px] pointer-events-none z-0"
        aria-hidden="true"
      />
      <div
        className="fixed bottom-10 left-1/3 w-[350px] h-[350px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none z-0"
        aria-hidden="true"
      />

      {/* Grid Pattern Background Overlay */}
      <div
        className="fixed inset-0 opacity-[0.12] pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] z-0"
        aria-hidden="true"
      />

      {/* Top Header */}
      <AdminHeader
        sidebarOpen={mobileSidebarOpen}
        onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
      />

      {/* Body Area: Sidebar + Scrollable Main Content */}
      <div className="relative z-10 flex flex-1 min-h-[calc(100vh-4rem)]">
        <AdminSidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        <div className="flex flex-1 flex-col min-w-0">
          <main className="flex-1 min-w-0">
            {children ?? <Outlet />}
          </main>

          <AdminFooter />
        </div>
      </div>
    </div>
  );
}
