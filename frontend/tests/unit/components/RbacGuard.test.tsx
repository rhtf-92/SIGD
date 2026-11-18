import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RbacGuard from '../../../src/components/common/RbacGuard';

describe('RbacGuard Component - Aislamiento y Restricción por Roles (12 Tests)', () => {
  it('1. Renderiza contenido protegido si el usuario posee el claim requerido', () => {
    render(
      <RbacGuard permission="EXPEDIENTE_DERIVAR" userPermissions={['EXPEDIENTE_DERIVAR']}>
        <button>Derivar Expediente</button>
      </RbacGuard>
    );
    expect(screen.getByText('Derivar Expediente')).toBeDefined();
  });

  it('2. Oculta contenido protegido si el usuario carece del claim requerido', () => {
    render(
      <RbacGuard permission="EXPEDIENTE_FIRMAR" userPermissions={['EXPEDIENTE_CREAR']}>
        <button>Firmar Resolución</button>
      </RbacGuard>
    );
    expect(screen.queryByText('Firmar Resolución')).toBeNull();
  });

  it('3. Valida restricción estricta para rol ESTUDIANTE sobre GESTION_ROLES', () => {
    render(
      <RbacGuard permission="GESTION_ROLES" userPermissions={['EXPEDIENTE_CREAR']}>
        <div>Panel Admin</div>
      </RbacGuard>
    );
    expect(screen.queryByText('Panel Admin')).toBeNull();
  });

  it('4. Valida acceso correcto para rol SUPER_ADMIN', () => {
    render(
      <RbacGuard permission="CONFIG_CALENDARIO" userPermissions={['CONFIG_CALENDARIO', 'GESTION_ROLES']}>
        <div>Configuración Calendario</div>
      </RbacGuard>
    );
    expect(screen.getByText('Configuración Calendario')).toBeDefined();
  });

  it('5. Valida comportamiento con fallback personalizado ante falta de permisos', () => {
    render(
      <RbacGuard permission="EXPEDIENTE_FIRMAR" userPermissions={['ESTUDIANTE']} fallback={<span>Acceso Denegado</span>}>
        <button>Firmar</button>
      </RbacGuard>
    );
    expect(screen.getByText('Acceso Denegado')).toBeDefined();
  });

  it('6. Valida aislamiento visual para rol DOCENTE sin permisos de derivación', () => {
    render(
      <RbacGuard permission="EXPEDIENTE_DERIVAR" userPermissions={['EXPEDIENTE_CREAR']}>
        <button>Derivar</button>
      </RbacGuard>
    );
    expect(screen.queryByText('Derivar')).toBeNull();
  });

  it('7. Valida renderizado por defecto sin fallback si no se provee', () => {
    const { container } = render(
      <RbacGuard permission="ADMIN_TOTAL" userPermissions={[]}>
        <span>Secreto</span>
      </RbacGuard>
    );
    expect(container.firstChild).toBeNull();
  });

  it('8. Permite acceso múltiple si el permiso coincide exactamente', () => {
    render(
      <RbacGuard permission="EXPEDIENTE_CREAR" userPermissions={['EXPEDIENTE_CREAR']}>
        <span>Crear Expediente</span>
      </RbacGuard>
    );
    expect(screen.getByText('Crear Expediente')).toBeDefined();
  });

  it('9. Restringe adecuadamente a MESA_PARTES frente a firmas electrónicas', () => {
    render(
      <RbacGuard permission="EXPEDIENTE_FIRMAR" userPermissions={['EXPEDIENTE_CREAR', 'EXPEDIENTE_DERIVAR']}>
        <span>Firmar Documento</span>
      </RbacGuard>
    );
    expect(screen.queryByText('Firmar Documento')).toBeNull();
  });

  it('10. Valida resistencia ante lista de permisos vacía del usuario', () => {
    render(
      <RbacGuard permission="EXPEDIENTE_CREAR" userPermissions={[]}>
        <span>Boton Protegido</span>
      </RbacGuard>
    );
    expect(screen.queryByText('Boton Protegido')).toBeNull();
  });

  it('11. Valida correcta evaluación para rol DIRECTOR en derivaciones', () => {
    render(
      <RbacGuard permission="EXPEDIENTE_DERIVAR" userPermissions={['EXPEDIENTE_DERIVAR', 'EXPEDIENTE_FIRMAR']}>
        <span>Panel Director</span>
      </RbacGuard>
    );
    expect(screen.getByText('Panel Director')).toBeDefined();
  });

  it('12. Asegura que ningún componente hijo filtre información sin autorización', () => {
    render(
      <RbacGuard permission="CONFIG_CALENDARIO" userPermissions={['ESTUDIANTE']}>
        <div>Datos Sensibles Calendario</div>
      </RbacGuard>
    );
    expect(screen.queryByText('Datos Sensibles Calendario')).toBeNull();
  });
});