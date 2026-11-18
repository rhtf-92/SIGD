import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  Button,
  Badge,
  StatusBadge,
  Card,
  Input,
  Select,
  Textarea,
  ModalBase,
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  EmptyState,
  InlineLoading,
  ProcessStepper,
  Breadcrumbs,
  Tooltip,
  TechnicalDetails,
} from "../../../../src/components/ui";
import FeriadosConfigModal from "../../../../src/components/admin/FeriadosConfigModal";

describe("Fase UX/UI 2 — Suite de Componentes Visuales Reutilizables", () => {
  /* ------------------------------------------------------------------------- */
  /* 1. BUTTON                                                                 */
  /* ------------------------------------------------------------------------- */
  describe("Button", () => {
    it("renderiza variantes primarias, secundarias y de peligro con estilos apropiados", () => {
      const { rerender } = render(<Button variant="primary">Guardar</Button>);
      expect(screen.getByRole("button", { name: "Guardar" })).toHaveClass("bg-suiza-primary");

      rerender(<Button variant="secondary">Cancelar</Button>);
      expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass("bg-surface-card");

      rerender(<Button variant="danger">Eliminar</Button>);
      expect(screen.getByRole("button", { name: "Eliminar" })).toHaveClass("bg-danger");
    });

    it("cumple con touch target de 44px en tamaño md y mantiene sm compacto", () => {
      const { rerender } = render(<Button size="md">Botón Normal</Button>);
      expect(screen.getByRole("button", { name: "Botón Normal" })).toHaveClass("min-h-[44px]");

      rerender(<Button size="sm">Botón Tabla</Button>);
      expect(screen.getByRole("button", { name: "Botón Tabla" })).toHaveClass("h-8");
    });

    it("maneja estado isLoading: muestra spinner, deshabilita botón y muestra loadingText", () => {
      render(
        <Button variant="primary" isLoading loadingText="Guardando...">
          Confirmar
        </Button>
      );
      const btn = screen.getByRole("button", { name: /Guardando.../i });
      expect(btn).toBeDisabled();
      expect(btn).toHaveAttribute("aria-busy", "true");
    });
  });

  /* ------------------------------------------------------------------------- */
  /* 2. BADGE & STATUS BADGE                                                   */
  /* ------------------------------------------------------------------------- */
  describe("Badge & StatusBadge", () => {
    it("mapea estados de éxito, advertencia, peligro y neutral", () => {
      const { rerender } = render(<StatusBadge status="RESUELTO" />);
      expect(screen.getByText("Resuelto")).toBeInTheDocument();
      expect(screen.getByText("Resuelto").parentElement).toHaveClass("bg-emerald-50");

      rerender(<StatusBadge status="EN_TRAMITE" />);
      expect(screen.getByText("En Trámite")).toBeInTheDocument();
      expect(screen.getByText("En Trámite").parentElement).toHaveClass("bg-amber-50");

      rerender(<StatusBadge status="OBSERVADO" />);
      expect(screen.getByText("Observado")).toBeInTheDocument();
      expect(screen.getByText("Observado").parentElement).toHaveClass("bg-orange-50");

      rerender(<StatusBadge status="RECHAZADO" />);
      expect(screen.getByText("Rechazado")).toBeInTheDocument();
      expect(screen.getByText("Rechazado").parentElement).toHaveClass("bg-red-50");

      rerender(<StatusBadge status="ARCHIVADO" />);
      expect(screen.getByText("Archivado")).toBeInTheDocument();
      expect(screen.getByText("Archivado").parentElement).toHaveClass("bg-slate-100");
    });

    it("Badge genérico soporta icono y dot", () => {
      render(
        <Badge variant="info" dot>
          Subdirección Académica
        </Badge>
      );
      expect(screen.getByText("Subdirección Académica")).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------------- */
  /* 3. CARD                                                                   */
  /* ------------------------------------------------------------------------- */
  describe("Card", () => {
    it("renderiza con título, descripción, acción y pie de tarjeta", () => {
      render(
        <Card
          title="Resumen del Trámite"
          description="Información general"
          headerAction={<Button size="sm">Editar</Button>}
          footer={<p>Actualizado hoy</p>}
        >
          <p>Cuerpo del contenido</p>
        </Card>
      );

      expect(screen.getByRole("heading", { name: "Resumen del Trámite" })).toBeInTheDocument();
      expect(screen.getByText("Información general")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
      expect(screen.getByText("Cuerpo del contenido")).toBeInTheDocument();
      expect(screen.getByText("Actualizado hoy")).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------------- */
  /* 4. INPUT, SELECT & TEXTAREA                                               */
  /* ------------------------------------------------------------------------- */
  describe("Form Controls (Input, Select, Textarea)", () => {
    it("Input renderiza label, required, helperText y error amigable", () => {
      const { rerender } = render(
        <Input
          label="DNI del Solicitante"
          required
          helperText="Ingrese 8 dígitos numéricos"
        />
      );

      expect(screen.getByLabelText(/DNI del Solicitante/i)).toBeInTheDocument();
      expect(screen.getByText("Ingrese 8 dígitos numéricos")).toBeInTheDocument();

      rerender(
        <Input
          label="DNI del Solicitante"
          error="El documento no coincide con el padrón registrado."
        />
      );
      expect(screen.getByText("El documento no coincide con el padrón registrado.")).toBeInTheDocument();
      expect(screen.getByLabelText(/DNI del Solicitante/i)).toHaveAttribute("aria-invalid", "true");
    });

    it("Select renderiza opciones y responde a eventos", () => {
      render(
        <Select
          label="Tipo de Trámite"
          options={[
            { value: "T1", label: "Certificado de Estudios" },
            { value: "T2", label: "Constancia de Matrícula" },
          ]}
        />
      );

      expect(screen.getByLabelText(/Tipo de Trámite/i)).toBeInTheDocument();
      expect(screen.getByText("Certificado de Estudios")).toBeInTheDocument();
    });

    it("Textarea renderiza con soporte para filas y accesibilidad", () => {
      render(<Textarea label="Fundamentación del Petitorio" rows={4} />);
      expect(screen.getByLabelText(/Fundamentación del Petitorio/i)).toBeInTheDocument();
    });

    it("Input y Select cumplen con touch target mínimo de 44px (min-h-[44px])", () => {
      render(
        <div>
          <Input label="Campo Táctil" />
          <Select label="Selector Táctil">
            <option value="1">Opción 1</option>
          </Select>
        </div>
      );

      expect(screen.getByLabelText("Campo Táctil")).toHaveClass("min-h-[44px]");
      expect(screen.getByLabelText("Selector Táctil")).toHaveClass("min-h-[44px]");
    });
  });

  /* ------------------------------------------------------------------------- */
  /* 5. MODAL BASE                                                             */
  /* ------------------------------------------------------------------------- */
  describe("ModalBase", () => {
    it("renderiza en portal hacia document.body y cierra con tecla Escape", async () => {
      const onClose = vi.fn();
      render(
        <ModalBase
          isOpen={true}
          onClose={onClose}
          title="Confirmar Asignación"
          subtitle="Área de Destino: Subdirección Académica"
          footer={<Button onClick={onClose}>Aceptar</Button>}
        >
          <p>¿Desea asignar el expediente a este operador?</p>
        </ModalBase>
      );

      expect(screen.getByRole("dialog", { name: /Confirmar Asignación/i })).toBeInTheDocument();
      expect(screen.getByText("¿Desea asignar el expediente a este operador?")).toBeInTheDocument();

      // Cierre con Escape
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).toHaveBeenCalled();
    });

    it("cierra al hacer click en el botón X", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render(
        <ModalBase isOpen={true} onClose={onClose} title="Prueba Cierre">
          <p>Contenido</p>
        </ModalBase>
      );

      const closeBtn = screen.getByRole("button", { name: /Cerrar modal/i });
      await user.click(closeBtn);
      expect(onClose).toHaveBeenCalled();
    });

    it("botón de cierre X cumple con touch target accesible (min-h-[44px] min-w-[44px])", () => {
      render(
        <ModalBase isOpen={true} onClose={() => {}} title="Touch Target Modal">
          <p>Contenido</p>
        </ModalBase>
      );
      const closeBtn = screen.getByRole("button", { name: /Cerrar modal/i });
      expect(closeBtn).toHaveClass("min-h-[44px]");
      expect(closeBtn).toHaveClass("min-w-[44px]");
    });

    it("enfoca el primer elemento interactivo al abrir el modal", () => {
      render(
        <ModalBase isOpen={true} onClose={() => {}} title="Foco Inicial">
          <input data-testid="primer-campo" placeholder="Escriba aquí" />
          <Button>Guardar</Button>
        </ModalBase>
      );
      const closeBtn = screen.getByRole("button", { name: /Cerrar modal/i });
      expect(closeBtn).toHaveFocus();
    });

    it("atrapa el foco cíclicamente con Tab y Shift+Tab dentro del modal", () => {
      render(
        <ModalBase
          isOpen={true}
          onClose={() => {}}
          title="Focus Trap Modal"
          footer={<Button data-testid="ultimo-boton">Guardar</Button>}
        >
          <input data-testid="campo-cuerpo" placeholder="Campo" />
        </ModalBase>
      );

      const closeBtn = screen.getByRole("button", { name: /Cerrar modal/i });
      const lastBtn = screen.getByTestId("ultimo-boton");

      // Enfocar el último elemento y presionar Tab -> debe rotar al primero (closeBtn)
      lastBtn.focus();
      expect(lastBtn).toHaveFocus();

      fireEvent.keyDown(window, { key: "Tab" });
      expect(closeBtn).toHaveFocus();

      // Desde el primer elemento presionar Shift+Tab -> debe rotar al último (lastBtn)
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
      expect(lastBtn).toHaveFocus();
    });

    it("restaura el foco al elemento disparador al cerrar el modal", async () => {
      const user = userEvent.setup();
      function TriggerWrapper() {
        const [open, setOpen] = useState(false);
        return (
          <div>
            <button data-testid="btn-disparador" onClick={() => setOpen(true)}>
              Abrir Modal
            </button>
            <ModalBase isOpen={open} onClose={() => setOpen(false)} title="Restaurar Foco">
              <p>Texto</p>
            </ModalBase>
          </div>
        );
      }

      render(<TriggerWrapper />);
      const triggerBtn = screen.getByTestId("btn-disparador");

      // Abrir modal con click
      await user.click(triggerBtn);
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Cerrar modal pulsando Escape
      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      // El foco debe volver al botón disparador
      expect(triggerBtn).toHaveFocus();
    });

    it("controla el cierre con flags closeOnEscape y closeOnBackdrop", async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const { rerender } = render(
        <ModalBase
          isOpen={true}
          onClose={onClose}
          title="Modal Restrictivo"
          closeOnEscape={false}
          closeOnBackdrop={false}
        >
          <p>Modal no cancelable por click o escape</p>
        </ModalBase>
      );

      // Escape no debe cerrar
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();

      // Click en backdrop (presentation) no debe cerrar
      const backdrop = screen.getByRole("presentation");
      await user.click(backdrop);
      expect(onClose).not.toHaveBeenCalled();

      // Ahora permitir backdrop y verificar
      rerender(
        <ModalBase
          isOpen={true}
          onClose={onClose}
          title="Modal Restrictivo"
          closeOnEscape={false}
          closeOnBackdrop={true}
        >
          <p>Modal no cancelable por click o escape</p>
        </ModalBase>
      );

      await user.click(screen.getByRole("presentation"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  /* ------------------------------------------------------------------------- */
  /* 6. SKELETON                                                               */
  /* ------------------------------------------------------------------------- */
  describe("Skeleton Family", () => {
    it("renderiza Skeleton, SkeletonText, SkeletonCard y SkeletonTable con estabilidad de layout", () => {
      render(
        <div>
          <Skeleton className="h-6 w-32" />
          <SkeletonText lines={2} />
          <SkeletonCard />
          <SkeletonTable rows={3} columns={4} />
        </div>
      );

      expect(screen.getByLabelText("Cargando datos de tabla")).toBeInTheDocument();
      expect(screen.getByLabelText("Cargando tarjeta")).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------------- */
  /* 7. EMPTY STATE                                                            */
  /* ------------------------------------------------------------------------- */
  describe("EmptyState", () => {
    it("renderiza mensaje amigable y acción directa de recuperación", () => {
      const onAction = vi.fn();
      render(
        <EmptyState
          title="No se encontraron expedientes"
          description="Intente modificar o restablecer los criterios de búsqueda aplicados."
          action={<Button onClick={onAction}>Limpiar filtros</Button>}
        />
      );

      expect(screen.getByText("No se encontraron expedientes")).toBeInTheDocument();
      expect(screen.getByText(/Intente modificar o restablecer/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------------- */
  /* 8. LOADING & PROCESS STEPPER                                              */
  /* ------------------------------------------------------------------------- */
  describe("InlineLoading & ProcessStepper", () => {
    it("InlineLoading muestra spinner y mensaje", () => {
      render(<InlineLoading message="Generando Cédula de Acuse..." />);
      expect(screen.getByText("Generando Cédula de Acuse...")).toBeInTheDocument();
    });

    it("ProcessStepper representa etapas discretas (completado, actual, pendiente)", () => {
      render(
        <ProcessStepper
          steps={[
            { id: "s1", title: "Identificación", status: "completed" },
            { id: "s2", title: "Carga de Requisitos", status: "current" },
            { id: "s3", title: "Emisión de Cargo", status: "pending" },
          ]}
        />
      );

      expect(screen.getByText("Identificación")).toBeInTheDocument();
      expect(screen.getByText("Carga de Requisitos")).toBeInTheDocument();
      expect(screen.getByText("Emisión de Cargo")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------------- */
  /* 9. BREADCRUMBS                                                            */
  /* ------------------------------------------------------------------------- */
  describe("Breadcrumbs", () => {
    it("renderiza migas de pan y sanitiza UUIDs en lugar de mostrarlos crudos", () => {
      render(
        <MemoryRouter>
          <Breadcrumbs
            items={[
              { label: "Bandeja de Expedientes", href: "/expedientes" },
              { label: "019488a0-0002-7a20-9bf0-692131bb291a", current: true },
            ]}
          />
        </MemoryRouter>
      );

      expect(screen.getByText("Bandeja de Expedientes")).toBeInTheDocument();
      // El UUID crudo no debe mostrarse, debe sanitizarse a 'Detalle'
      expect(screen.queryByText("019488a0-0002-7a20-9bf0-692131bb291a")).not.toBeInTheDocument();
      expect(screen.getByText("Detalle")).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------------- */
  /* 10. TOOLTIP                                                               */
  /* ------------------------------------------------------------------------- */
  describe("Tooltip", () => {
    it("muestra descripción contextual al pasar el ratón", async () => {
      const user = userEvent.setup();
      render(
        <Tooltip content="Código de Verificación Digital conforme a Ley">
          <button type="button">¿Qué es CVD?</button>
        </Tooltip>
      );

      const trigger = screen.getByRole("button", { name: "¿Qué es CVD?" });
      await user.hover(trigger);

      expect(screen.getByRole("tooltip")).toHaveTextContent("Código de Verificación Digital conforme a Ley");
    });
  });

  /* ------------------------------------------------------------------------- */
  /* 11. TECHNICAL DETAILS                                                     */
  /* ------------------------------------------------------------------------- */
  describe("TechnicalDetails", () => {
    it("permanece colapsado por defecto y se expande a solicitud del usuario", async () => {
      const user = userEvent.setup();
      render(
        <TechnicalDetails
          items={[
            { label: "SHA-256", value: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", copyable: true },
            { label: "UUID", value: "019488a0-0001-7a20-9bf0-692131bb291a" },
          ]}
        />
      );

      // Colapsado por defecto
      expect(screen.queryByText(/e3b0c44298fc1c149/)).not.toBeInTheDocument();

      // Al pulsar se expande
      const toggle = screen.getByRole("button", { name: /Detalles Técnicos y Auditoría Criptográfica/i });
      await user.click(toggle);

      expect(screen.getByText(/e3b0c44298fc1c149/)).toBeInTheDocument();
      expect(screen.getByText("019488a0-0001-7a20-9bf0-692131bb291a")).toBeInTheDocument();
    });
  });

  /* ------------------------------------------------------------------------- */
  /* 12. PILOTO: FeriadosConfigModal (Migrado a ModalBase + UI)                  */
  /* ------------------------------------------------------------------------- */
  describe("Pilot Migration — FeriadosConfigModal", () => {
    it("opera correctamente con la nueva base de ModalBase, Button e Input", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const onClose = vi.fn();

      render(
        <FeriadosConfigModal
          isOpen={true}
          onClose={onClose}
          onSave={onSave}
        />
      );

      expect(screen.getByRole("dialog", { name: /Registrar Nuevo Feriado/i })).toBeInTheDocument();

      await user.type(screen.getByLabelText(/Fecha del Feriado/i), "2026-10-08");
      await user.type(screen.getByLabelText(/Descripción \/ Motivo/i), "Combate de Angamos");
      await user.click(screen.getByRole("button", { name: "Guardar Feriado" }));

      expect(onSave).toHaveBeenCalledWith({
        fecha: "2026-10-08",
        descripcion: "Combate de Angamos",
        tipo: "NACIONAL",
        impactaSla: true,
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
