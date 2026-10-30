import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BrandingColumn from "../components/auth/BrandingColumn";
import LoginFormCard, { ROLES_CANONICOS } from "../components/auth/LoginFormCard";
import LoginFooter from "../components/auth/LoginFooter";

export { ROLES_CANONICOS };

export function LoginSIGD(): React.JSX.Element {
  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-[#f8fafc] text-slate-900 font-sans antialiased selection:bg-[#0c2340] selection:text-white">
      <BrandingColumn />

      <section
        aria-label="Acceso al Sistema SIGD"
        className="flex min-h-screen flex-1 flex-col justify-between bg-[#f8fafc] px-4 py-8 sm:px-8 lg:px-12"
      >
        <div className="w-full max-w-md mx-auto flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 hover:text-[#0c2340] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Volver al portal público</span>
          </Link>
        </div>

        <div className="my-auto w-full flex items-center justify-center py-6">
          <LoginFormCard />
        </div>

        <div className="w-full max-w-md mx-auto">
          <LoginFooter />
        </div>
      </section>
    </main>
  );
}

export default LoginSIGD;
