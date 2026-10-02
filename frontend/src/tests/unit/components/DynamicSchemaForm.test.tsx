import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DynamicSchemaForm, type JSONSchema } from '../../../features/tramites/DynamicSchemaForm';

// Esquema de prueba mock simulando un JSON Schema Draft 2020-12
const mockSchema: JSONSchema = {
  type: 'object',
  required: ['asunto', 'facultad'],
  properties: {
    asunto: {
      type: 'string',
      title: 'Asunto del Trámite',
      description: 'Ingrese el asunto breve',
      minLength: 5,
    },
    facultad: {
      type: 'string',
      title: 'Facultad',
      enum: ['Ingeniería de Sistemas', 'Derecho', 'Medicina'],
    },
    correo: {
      type: 'string',
      title: 'Correo Electrónico',
      format: 'email',
    },
    aceptaDeclaracion: {
      type: 'boolean',
      title: 'Declaro que la información es verdadera',
    },
  },
};

describe('DynamicSchemaForm Component', () => {
  it('1. Renderiza correctamente el mensaje cuando el esquema es inválido o nulo', () => {
    render(<DynamicSchemaForm schema={null} onSubmit={vi.fn()} />);
    expect(screen.getByText(/esquema de formulario no válido o vacío/i)).toBeInTheDocument();
  });

  it('2. Renderiza todos los campos dinámicos definidos en el JSON Schema', () => {
    render(<DynamicSchemaForm schema={mockSchema} onSubmit={vi.fn()} />);

    expect(screen.getByText(/asunto del trámite/i)).toBeInTheDocument();
    expect(screen.getByText(/facultad/i)).toBeInTheDocument();
    expect(screen.getByText(/correo electrónico/i)).toBeInTheDocument();
    expect(screen.getByText(/declaro que la información es verdadera/i)).toBeInTheDocument();
  });

  it('3. Muestra el asterisco de campo obligatorio solo en las propiedades requeridas', () => {
    render(<DynamicSchemaForm schema={mockSchema} onSubmit={vi.fn()} />);

    // 'asunto' y 'facultad' son requeridos en el mockSchema
    const asuntoLabel = screen.getByText(/asunto del trámite/i);
    expect(asuntoLabel.textContent).toContain('*');

    const correoLabel = screen.getByText(/correo electrónico/i);
    expect(correoLabel.textContent).not.toContain('*');
  });

  it('4. Valida campos requeridos vacíos al enviar el formulario y muestra errores en español', async () => {
    const handleSubmit = vi.fn();
    render(<DynamicSchemaForm schema={mockSchema} onSubmit={handleSubmit} />);

    const submitBtn = screen.getByRole('button', { name: /registrar trámite/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/este campo es requerido/i).length).toBeGreaterThan(0);
    });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('5. Valida la longitud mínima (minLength) en campos de texto', async () => {
    render(<DynamicSchemaForm schema={mockSchema} onSubmit={vi.fn()} />);

    const asuntoInput = screen.getByPlaceholderText('Ingrese el asunto breve');
    fireEvent.change(asuntoInput, { target: { value: 'abc' } }); // Menos de 5 caracteres

    const submitBtn = screen.getByRole('button', { name: /registrar trámite/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/mínimo 5 caracteres/i)).toBeInTheDocument();
    });
  });

  it('6. Renderiza las opciones del menú desplegable (select) a partir del enum del esquema', () => {
    render(<DynamicSchemaForm schema={mockSchema} onSubmit={vi.fn()} />);

    const selectElement = screen.getByRole('combobox');
    expect(selectElement).toBeInTheDocument();

    expect(screen.getByRole('option', { name: 'Ingeniería de Sistemas' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Derecho' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Medicina' })).toBeInTheDocument();
  });

  it('7. Emite los datos recopilados al ejecutar onSubmit correctamente cuando todo está válido', async () => {
    const handleSubmit = vi.fn();
    render(<DynamicSchemaForm schema={mockSchema} onSubmit={handleSubmit} />);

    const asuntoInput = screen.getByPlaceholderText('Ingrese el asunto breve');
    const selectFacultad = screen.getByRole('combobox');
    const submitBtn = screen.getByRole('button', { name: /registrar trámite/i });

    fireEvent.change(asuntoInput, { target: { value: 'Solicitud de Certificado de Estudios' } });
    fireEvent.change(selectFacultad, { target: { value: 'Ingeniería de Sistemas' } });

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          asunto: 'Solicitud de Certificado de Estudios',
          facultad: 'Ingeniería de Sistemas',
        })
      );
    });
  });

  it('8. Deshabilita el botón de envío si la propiedad isSubmitting es verdadera', () => {
    render(<DynamicSchemaForm schema={mockSchema} onSubmit={vi.fn()} isSubmitting={true} />);

    const submitBtn = screen.getByRole('button', { name: /procesando/i });
    expect(submitBtn).toBeDisabled();
  });
});