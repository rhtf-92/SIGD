import type { ReactNode } from "react";

import AsistenteIA from "../components/asistente/AsistenteIA";
import FooterInstitucional from "../components/FooterInstitucional";
import HeaderInstitucional from "../components/HeaderInstitucional";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#F3F4F6] text-[#111111]">
      <HeaderInstitucional />

      <div className="flex-1">{children}</div>

      <FooterInstitucional />
      <AsistenteIA />
    </div>
  );
}
