import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach } from 'vitest';
import TablasMaestrasPage from '@/pages/administracion/TablasMaestrasPage';
import { TIPOS_TABLA } from '@/hooks/useTablasMaestras';
import { useAuthStore } from '@/stores/authStore';

function renderConRouter() {
  return render(
    <MemoryRouter initialEntries={['/administracion/tablas-maestras']}>
      <TablasMaestrasPage />
    </MemoryRouter>
  );
}

describe('Tablas Maestras — Catálogo TUPA, Versiones y Requisitos (Parte 4)', () => {
  afterEach(() => {
    useAuthStore.setState({ usuario: null, isAuthenticated: false });
  });

  it('1. Incluye la pestaña de Catálogo TUPA dentro de TIPOS_TABLA sin crear tarjetas nuevas', () => {
    expect(TIPOS_TABLA).toContain('Catálogo TUPA (Versiones y Requisitos)');
    renderConRouter();
    expect(
      screen.getByRole('button', { name: /Catálogo TUPA \(Versiones y Requisitos\)/i })
    ).toBeInTheDocument();
  });

  it('2. Al activar la pestaña TUPA muestra el selector de versiones y la certificación de los 197 expedientes', () => {
    renderConRouter();
    const tabTupa = screen.getByRole('button', { name: /Catálogo TUPA \(Versiones y Requisitos\)/i });
    fireEvent.click(tabTupa);

    // Selector de versiones
    expect(screen.getByLabelText(/Versión activa:/i)).toBeInTheDocument();
    expect(screen.getByText(/TUPA-2026-V1 — TUPA Institucional 2026/i)).toBeInTheDocument();

    // Banner de auditoría de los 197 expedientes
    expect(screen.getByText(/Auditoría de Integridad: AUDITORIA_INTEGRA/i)).toBeInTheDocument();
    expect(screen.getByText(/0 reasignaciones arbitrarias • 0 costos alterados/i)).toBeInTheDocument();
  });

  it('3. Muestra los procedimientos del catálogo con numeración del 001 al 072', () => {
    renderConRouter();
    const tabTupa = screen.getByRole('button', { name: /Catálogo TUPA \(Versiones y Requisitos\)/i });
    fireEvent.click(tabTupa);

    // Filtros de validación
    expect(screen.getByRole('button', { name: /Todos \(72\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Validados oficial \(36\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pendientes de validación institucional \(36\)/i })).toBeInTheDocument();

    // Procedimiento 001 y 072
    expect(screen.getByText(/001 — SUZ26-001/i)).toBeInTheDocument();
    expect(screen.getByText(/Prácticas Iniciales/i)).toBeInTheDocument();
    expect(screen.getByText(/072 — SUZ26-072/i)).toBeInTheDocument();
  });

  it('4. Abre el modal de detalle mostrando unidades responsables, autoridad resolutiva y requisitos', () => {
    renderConRouter();
    const tabTupa = screen.getByRole('button', { name: /Catálogo TUPA \(Versiones y Requisitos\)/i });
    fireEvent.click(tabTupa);

    const botonesDetalle = screen.getAllByRole('button', { name: /Ver Detalle/i });
    expect(botonesDetalle.length).toBeGreaterThan(0);
    fireEvent.click(botonesDetalle[0]);

    // Modal abierto
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Unidad de presentación:/i)).toBeInTheDocument();
    expect(screen.getByText(/Mesa de Partes \(MP\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Unidad responsable:/i)).toBeInTheDocument();
    expect(screen.getByText(/Autoridad resolutiva:/i)).toBeInTheDocument();
    expect(screen.getByText(/Requisitos Documentales/i)).toBeInTheDocument();

    // Botón cerrar
    const botonCerrar = screen.getByRole('button', { name: /Cerrar/i });
    fireEvent.click(botonCerrar);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('5. Usuario con rol ADMINISTRADOR visualiza opciones para crear borrador y publicar versión oficial', () => {
    useAuthStore.setState({
      usuario: {
        id: 'usr-admin-123',
        nombreCompleto: 'Administrador General',
        correo: 'admin@iestpsuiza.edu.pe',
        rol: 'ADMINISTRADOR',
        roles: ['ADMINISTRADOR'],
      },
      isAuthenticated: true,
    });

    renderConRouter();
    const tabTupa = screen.getByRole('button', { name: /Catálogo TUPA \(Versiones y Requisitos\)/i });
    fireEvent.click(tabTupa);

    expect(screen.getByRole('button', { name: /\+ Nuevo Borrador/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publicar Versión Oficial/i })).toBeInTheDocument();
  });

  it('6. Usuario con rol SUPER_ADMIN también visualiza opciones de gestión y publicación TUPA', () => {
    useAuthStore.setState({
      usuario: {
        id: 'usr-superadmin-001',
        nombreCompleto: 'Super Administrador',
        correo: 'superadmin@iestpsuiza.edu.pe',
        rol: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN'],
      },
      isAuthenticated: true,
    });

    renderConRouter();
    const tabTupa = screen.getByRole('button', { name: /Catálogo TUPA \(Versiones y Requisitos\)/i });
    fireEvent.click(tabTupa);

    expect(screen.getByRole('button', { name: /\+ Nuevo Borrador/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publicar Versión Oficial/i })).toBeInTheDocument();
  });

  it('7. Usuario con rol no administrativo (CIUDADANO o anónimo) NO visualiza botones de crear ni publicar', () => {
    useAuthStore.setState({
      usuario: {
        id: 'usr-ciudadano-999',
        nombreCompleto: 'Juan Ciudadano',
        correo: 'juan@gmail.com',
        rol: 'CIUDADANO',
        roles: ['CIUDADANO'],
      },
      isAuthenticated: true,
    });

    renderConRouter();
    const tabTupa = screen.getByRole('button', { name: /Catálogo TUPA \(Versiones y Requisitos\)/i });
    fireEvent.click(tabTupa);

    expect(screen.queryByRole('button', { name: /\+ Nuevo Borrador/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publicar Versión Oficial/i })).not.toBeInTheDocument();
  });
});
