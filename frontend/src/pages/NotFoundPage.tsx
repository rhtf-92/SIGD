import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main className="sigd-not-found flex min-h-[calc(100vh-14rem)] items-center justify-center px-4 py-12">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">
        <p className="font-mono text-5xl font-black text-blue-800 sm:text-6xl">404</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Página no encontrada
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
          La página o trámite que buscas no existe, ha cambiado de dirección o no está disponible temporalmente.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            to="/"
            className="sigd-button sigd-button-primary w-full sm:w-auto"
          >
            Ir al inicio
          </Link>
          <Link
            to="/tupa"
            className="sigd-button sigd-button-secondary w-full sm:w-auto"
          >
            Buscar un trámite
          </Link>
          <Link
            to="/consulta"
            className="sigd-button sigd-button-secondary w-full sm:w-auto"
          >
            Consultar expediente
          </Link>
        </div>
      </section>
    </main>
  );
}
