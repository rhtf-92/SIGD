// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import VentanillaPresencialPage, {
  mapearEtiquetaHumanaTipo,
} from '../../../src/pages/tramite/VentanillaPresencialPage';
import { TUPA_SUIZA_2026_COMPLETO } from '../../../src/data/tupaSuiza2026CatalogoCompleto';
import { apiClient } from '../../../src/api/client';
import { useAuthStore } from '../../../src/stores/authStore';

const CATALOGO_72_MOCK = TUPA_SUIZA_2026_COMPLETO.map((item, index) => ({
  registroVersionId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  denominacion: item.denominacion,
  monto: item.monto,
  requisitos: item.requisitos,
  estadoValidacion: item.estadoValidacion,
  revision: 1,
  vigenciaDesde: null,
  vigenciaHasta: null,
  fuente: {
    nombre: 'TUPA_2026_IESTP_Suiza.pdf',
    referenciaFila: item.referenciaFila,
    pagina: item.pagina,
  },
}));

describe('Ventanilla Presencial — Combobox 72 TUPA y UX Responsive', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      accessToken: 'jwt-admin',
      refreshToken: null,
      isAuthenticated: true,
      usuario: {
        id: 'u-admin',
        nombreCompleto: 'Admin General',
        correo: 'admin@iestpsuiza.edu.pe',
        rol: 'ADMINISTRADOR',
      },
    });
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: CATALOGO_72_MOCK });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  describe('1. Mapeo de Etiquetas Humanas (evitar enums crudos)', () => {
    it('mapea correctamente todos los tipos y clasificaciones técnicas a etiquetas legibles', () => {
      expect(mapearEtiquetaHumanaTipo('ACTUACION_INTERNA')).toBe('Actuación interna');
      expect(mapearEtiquetaHumanaTipo('PROCEDIMIENTO_APROBADO')).toBe('Procedimiento administrativo');
      expect(mapearEtiquetaHumanaTipo('PROCEDIMIENTO_PENDIENTE')).toBe('Procedimiento en revisión');
      expect(mapearEtiquetaHumanaTipo('SERVICIO_ACADEMICO')).toBe('Servicio académico');
      expect(mapearEtiquetaHumanaTipo('SERVICIO_COMERCIAL')).toBe('Servicio comercial');
      expect(mapearEtiquetaHumanaTipo('BIEN_PRODUCTIVO')).toBe('Venta de bien / Bien productivo');
      expect(mapearEtiquetaHumanaTipo('OTRO_NO_RADICABLE')).toBe('Otro servicio');
      expect(mapearEtiquetaHumanaTipo(null)).toBe('Trámite general');
      expect(mapearEtiquetaHumanaTipo(undefined)).toBe('Trámite general');
      expect(mapearEtiquetaHumanaTipo('TASA_ESPECIAL')).toBe('Tasa especial');
    });
  });

  describe('2. Búsqueda y Filtrado en Combobox (72 TUPA)', () => {
    it('filtra por denominación parcial ("mango") y muestra formato amigable', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      const comboboxInput = await screen.findByRole('combobox', {
        name: /Buscar TUPA por nombre/i,
      });

      // El catálogo hace exactamente 1 llamada inicial al endpoint
      expect(apiClient.get).toHaveBeenCalledTimes(1);

      await user.type(comboboxInput, 'mango');

      // Dropdown abierto con opciones filtradas
      const listbox = await screen.findByRole('listbox', {
        name: /Resultados de procedimientos TUPA 2026/i,
      });
      expect(listbox).toBeInTheDocument();

      const opcionMango = within(listbox).getByText(/Venta de Mangos/i);
      expect(opcionMango).toBeInTheDocument();
      expect(within(listbox).getByText('p2-fila-09')).toBeInTheDocument();
      expect(within(listbox).getByText('Venta de bien / Bien productivo')).toBeInTheDocument();

      // Las pulsaciones de tecla no dispararon peticiones HTTP adicionales (filtrado local en memoria)
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('filtra por código de fila ("p2-fila-09")', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      const comboboxInput = await screen.findByRole('combobox', {
        name: /Buscar TUPA por nombre/i,
      });

      await user.type(comboboxInput, 'p2-fila-09');

      const listbox = await screen.findByRole('listbox', {
        name: /Resultados de procedimientos TUPA 2026/i,
      });
      expect(within(listbox).getByText(/Venta de Mangos/i)).toBeInTheDocument();
      expect(within(listbox).getByText('p2-fila-09')).toBeInTheDocument();
    });

    it('filtra por clasificación amigable ("bien productivo")', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      const comboboxInput = await screen.findByRole('combobox', {
        name: /Buscar TUPA por nombre/i,
      });

      await user.type(comboboxInput, 'bien productivo');

      const listbox = await screen.findByRole('listbox', {
        name: /Resultados de procedimientos TUPA 2026/i,
      });
      expect(within(listbox).getByText(/Venta de Mangos/i)).toBeInTheDocument();
      expect(within(listbox).getByText('p2-fila-09')).toBeInTheDocument();
    });

    it('filtra por palabras parciales ("certificado ingles")', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      const comboboxInput = await screen.findByRole('combobox', {
        name: /Buscar TUPA por nombre/i,
      });

      await user.type(comboboxInput, 'certificado ingles');

      const listbox = await screen.findByRole('listbox', {
        name: /Resultados de procedimientos TUPA 2026/i,
      });
      expect(within(listbox).getByText(/Certificado de Inglés/i)).toBeInTheDocument();
      expect(within(listbox).getByText('p1-fila-06')).toBeInTheDocument();
    });
  });

  describe('3. Selección y Tarjeta Resumen con Botón Cambiar', () => {
    it('al seleccionar una opción cierra el dropdown, muestra la tarjeta resumen y permite cambiar', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      const comboboxInput = await screen.findByRole('combobox', {
        name: /Buscar TUPA por nombre/i,
      });

      await user.type(comboboxInput, 'mango');

      const listbox = await screen.findByRole('listbox', {
        name: /Resultados de procedimientos TUPA 2026/i,
      });
      const opcionMango = within(listbox).getByText(/Venta de Mangos/i);
      await user.click(opcionMango);

      // El dropdown se cierra
      await waitFor(() => {
        expect(
          screen.queryByRole('listbox', { name: /Resultados de procedimientos TUPA 2026/i })
        ).not.toBeInTheDocument();
      });

      // La tarjeta compacta muestra la información destacada
      expect(screen.getAllByText(/Venta de Mangos/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText('p2-fila-09').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Venta de bien / Bien productivo').length).toBeGreaterThan(0);
      expect(screen.getByRole('button', { name: /Cambiar procedimiento/i })).toBeInTheDocument();

      // Botón Cambiar procedimiento reabre el buscador
      await user.click(screen.getByRole('button', { name: /Cambiar procedimiento/i }));

      expect(
        await screen.findByRole('combobox', { name: /Buscar TUPA por nombre/i })
      ).toBeInTheDocument();
    });
  });

  describe('4. Navegación con Teclado (Flechas, Enter, Escape)', () => {
    it('permite navegar opciones con ArrowDown y seleccionar con Enter', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      const comboboxInput = await screen.findByRole('combobox', {
        name: /Buscar TUPA por nombre/i,
      });

      await user.type(comboboxInput, 'mango');
      const listbox = await screen.findByRole('listbox', {
        name: /Resultados de procedimientos TUPA 2026/i,
      });
      expect(within(listbox).getByText(/Venta de Mangos/i)).toBeInTheDocument();

      // Seleccionar con tecla Enter
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      // Se selecciona el procedimiento y se muestra la tarjeta
      await waitFor(() => {
        expect(screen.getAllByText(/Venta de Mangos/i).length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText('p2-fila-09').length).toBeGreaterThan(0);
    });

    it('cierra el dropdown con la tecla Escape', async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      const comboboxInput = await screen.findByRole('combobox', {
        name: /Buscar TUPA por nombre/i,
      });

      await user.type(comboboxInput, 'mango');
      expect(
        await screen.findByRole('listbox', { name: /Resultados de procedimientos TUPA 2026/i })
      ).toBeInTheDocument();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(
          screen.queryByRole('listbox', { name: /Resultados de procedimientos TUPA 2026/i })
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('5. Accesibilidad y Estructura Responsive', () => {
    it('cuenta con atributos ARIA requeridos y touch targets mínimos de 44px', async () => {
      render(
        <MemoryRouter>
          <VentanillaPresencialPage />
        </MemoryRouter>
      );

      const comboboxInput = await screen.findByRole('combobox', {
        name: /Buscar TUPA por nombre/i,
      });

      expect(comboboxInput).toHaveAttribute('aria-autocomplete', 'list');
      expect(comboboxInput).toHaveAttribute('aria-controls', 'tupa-combobox-listbox');
      expect(comboboxInput.className).toContain('min-h-[44px]');

      const botonSubmit = screen.getByRole('button', { name: /Registrar y Emitir Cargo CUT/i });
      expect(botonSubmit.className).toContain('min-h-[44px]');
    });
  });
});
