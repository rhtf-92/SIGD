import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Link, useNavigate } from "react-router-dom";
import ScrollToTop from "../../../src/components/common/ScrollToTop";

function DummyHome() {
  const navigate = useNavigate();
  return (
    <div style={{ height: "2000px" }}>
      <h1>Página Home</h1>
      <Link to="/consulta">Ir a Consulta CUT</Link>
      <Link to="/validador-cvd">Ir a Validador CVD</Link>
      <Link to="/transparencia#marco-legal">Ir a Transparencia con Hash</Link>
      <button onClick={() => navigate("/tramite")}>Redirect Ciudadano</button>
      <button onClick={() => navigate("/expedientes")}>Redirect Institucional</button>
    </div>
  );
}

function DummyConsulta() {
  return (
    <div style={{ height: "1500px" }}>
      <h1>Consulta Pública por CUT</h1>
      <Link to="/">Volver al Inicio</Link>
    </div>
  );
}

function DummyValidador() {
  return (
    <div style={{ height: "1500px" }}>
      <h1>Validador Público CVD</h1>
      <Link to="/">Volver al Inicio</Link>
    </div>
  );
}

function DummyTransparencia() {
  return (
    <div style={{ height: "2500px" }}>
      <h1>Transparencia</h1>
      <div id="marco-legal" style={{ marginTop: "1000px" }}>
        Sección Marco Legal
      </div>
    </div>
  );
}

function DummyApp({ initialEntries = ["/"] }: { initialEntries?: string[] }) {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<DummyHome />} />
        <Route path="/consulta" element={<DummyConsulta />} />
        <Route path="/validador-cvd" element={<DummyValidador />} />
        <Route path="/transparencia" element={<DummyTransparencia />} />
        <Route path="/tramite" element={<div>Mesa de Partes Virtual</div>} />
        <Route path="/expedientes" element={<div>Bandeja de Expedientes</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ScrollToTop — Restauración global de scroll en cambios de ruta", () => {
  let scrollToSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollToSpy = vi.fn();
    window.scrollTo = scrollToSpy as unknown as typeof window.scrollTo;
    document.documentElement.scrollTop = 500;
    document.body.scrollTop = 500;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Al montar en la ruta inicial, ejecuta window.scrollTo({ top: 0, left: 0, behavior: 'auto' })", () => {
    render(<DummyApp initialEntries={["/"]} />);
    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto",
    });
    expect(document.documentElement.scrollTop).toBe(0);
    expect(document.body.scrollTop).toBe(0);
  });

  it("2. Home -> Consulta CUT: al hacer clic, resetea la posición al tope superior (top: 0)", () => {
    render(<DummyApp initialEntries={["/"]} />);
    scrollToSpy.mockClear();

    // Simular que el usuario scrolleó hacia abajo en Home
    document.documentElement.scrollTop = 1200;

    const linkConsulta = screen.getByText("Ir a Consulta CUT");
    act(() => {
      linkConsulta.click();
    });

    expect(screen.getByText("Consulta Pública por CUT")).toBeInTheDocument();
    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto",
    });
    expect(document.documentElement.scrollTop).toBe(0);
  });

  it("3. Home -> Validador CVD: al navegar, garantiza inicio superior absoluto", () => {
    render(<DummyApp initialEntries={["/"]} />);
    scrollToSpy.mockClear();

    document.documentElement.scrollTop = 800;

    const linkCvd = screen.getByText("Ir a Validador CVD");
    act(() => {
      linkCvd.click();
    });

    expect(screen.getByText("Validador Público CVD")).toBeInTheDocument();
    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto",
    });
    expect(document.documentElement.scrollTop).toBe(0);
  });

  it("4. Redirección post-login por rol (navigate('/tramite')): abre en el tope superior", () => {
    render(<DummyApp initialEntries={["/"]} />);
    scrollToSpy.mockClear();

    document.documentElement.scrollTop = 600;

    const btnCiudadano = screen.getByText("Redirect Ciudadano");
    act(() => {
      btnCiudadano.click();
    });

    expect(screen.getByText("Mesa de Partes Virtual")).toBeInTheDocument();
    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "auto",
    });
    expect(document.documentElement.scrollTop).toBe(0);
  });

  it("5. Ruta A -> Ruta B -> Ruta C: ninguna hereda scroll arbitrariamente", () => {
    render(<DummyApp initialEntries={["/"]} />);

    // Paso A -> B (/consulta)
    scrollToSpy.mockClear();
    act(() => {
      screen.getByText("Ir a Consulta CUT").click();
    });
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });

    // Paso B -> A (volver a /)
    scrollToSpy.mockClear();
    document.documentElement.scrollTop = 950;
    act(() => {
      screen.getByText("Volver al Inicio").click();
    });
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });

    // Paso A -> C (/validador-cvd)
    scrollToSpy.mockClear();
    document.documentElement.scrollTop = 400;
    act(() => {
      screen.getByText("Ir a Validador CVD").click();
    });
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "auto" });
  });

  it("6. Navegación con Hash (#marco-legal): invoca scrollIntoView sobre el elemento ancla", () => {
    const scrollIntoViewSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewSpy;

    render(<DummyApp initialEntries={["/"]} />);
    scrollToSpy.mockClear();

    act(() => {
      screen.getByText("Ir a Transparencia con Hash").click();
    });

    expect(screen.getByText("Sección Marco Legal")).toBeInTheDocument();
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({
      behavior: "auto",
      block: "start",
    });
  });
});
