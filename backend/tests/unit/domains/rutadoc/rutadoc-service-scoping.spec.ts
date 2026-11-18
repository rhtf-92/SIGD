import { describe, it, expect, vi } from 'vitest';
import { ServicioRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.service.js';
import type { RepositorioRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.repository.js';
import type { ActorRutaDoc, FiltrosRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import { ForbiddenError } from '../../../../src/shared/domain/errors/index.js';

describe('ServicioRutaDoc — Control de acceso y scoping de área por rol', () => {
  const crearMockRepo = (): RepositorioRutaDoc => ({
    listar: vi.fn().mockResolvedValue({
      elementos: [],
      porEstado: {},
      porPestana: {
        PENDIENTES: 0,
        EN_TRAMITE: 0,
        DERIVADOS: 0,
        POR_FIRMAR: 0,
        ATENDIDOS: 0,
        ARCHIVADOS: 0,
      },
    }),
    obtener: vi.fn().mockResolvedValue(null),
  });

  it('1. Operador de área ESPECIALISTA es forzado a su unidad orgánica asignada', async () => {
    const repo = crearMockRepo();
    const servicio = new ServicioRutaDoc(repo);

    const actorEspecialista: ActorRutaDoc = {
      id: 'usr-esp-1',
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: 'a0000000-0000-0000-0000-000000000001',
    };

    const filtros: FiltrosRutaDoc = { pestana: 'PENDIENTES', limite: 20 };
    await servicio.listar(filtros, actorEspecialista);

    expect(repo.listar).toHaveBeenCalledTimes(1);
    const filtrosEnviados = vi.mocked(repo.listar).mock.calls[0][0];
    expect(filtrosEnviados.areaId).toBe('a0000000-0000-0000-0000-000000000001');
  });

  it('2. Operador SECRETARIO es forzado a su unidad orgánica asignada', async () => {
    const repo = crearMockRepo();
    const servicio = new ServicioRutaDoc(repo);

    const actorSecretario: ActorRutaDoc = {
      id: 'usr-sec-1',
      roles: ['SECRETARIO'],
      unidadOrganicaId: 'a0000000-0000-0000-0000-000000000001',
    };

    const filtros: FiltrosRutaDoc = { pestana: 'DERIVADOS', limite: 10 };
    await servicio.listar(filtros, actorSecretario);

    expect(repo.listar).toHaveBeenCalledTimes(1);
    const filtrosEnviados = vi.mocked(repo.listar).mock.calls[0][0];
    expect(filtrosEnviados.areaId).toBe('a0000000-0000-0000-0000-000000000001');
  });

  it('3. Rol ADMINISTRADOR conserva supervisión institucional global (no se fuerza su área)', async () => {
    const repo = crearMockRepo();
    const servicio = new ServicioRutaDoc(repo);

    const actorAdmin: ActorRutaDoc = {
      id: 'usr-admin-1',
      roles: ['ADMINISTRADOR'],
      unidadOrganicaId: 'a0000000-0000-0000-0000-000000000002',
    };

    const filtros: FiltrosRutaDoc = { pestana: 'PENDIENTES', limite: 20 };
    await servicio.listar(filtros, actorAdmin);

    expect(repo.listar).toHaveBeenCalledTimes(1);
    const filtrosEnviados = vi.mocked(repo.listar).mock.calls[0][0];
    expect(filtrosEnviados.areaId).toBeUndefined();
  });

  it('4. Rol DIRECTOR conserva supervisión institucional global (no se fuerza su área)', async () => {
    const repo = crearMockRepo();
    const servicio = new ServicioRutaDoc(repo);

    const actorDirector: ActorRutaDoc = {
      id: 'usr-dir-1',
      roles: ['DIRECTOR'],
      unidadOrganicaId: 'a0000000-0000-0000-0000-000000000002',
    };

    const filtros: FiltrosRutaDoc = { pestana: 'PENDIENTES', limite: 20 };
    await servicio.listar(filtros, actorDirector);

    expect(repo.listar).toHaveBeenCalledTimes(1);
    const filtrosEnviados = vi.mocked(repo.listar).mock.calls[0][0];
    expect(filtrosEnviados.areaId).toBeUndefined();
  });

  it('5. Rol no autorizado (CIUDADANO) lanza ForbiddenError al intentar listar bandeja', async () => {
    const repo = crearMockRepo();
    const servicio = new ServicioRutaDoc(repo);

    const actorCiudadano: ActorRutaDoc = {
      id: 'usr-ciud-1',
      roles: ['CIUDADANO'],
    };

    const filtros: FiltrosRutaDoc = { pestana: 'PENDIENTES', limite: 20 };
    await expect(servicio.listar(filtros, actorCiudadano)).rejects.toThrow(ForbiddenError);
    expect(repo.listar).not.toHaveBeenCalled();
  });

  it('6. Operador ESPECIALISTA que intenta inyectar areaId de otra unidad orgánica es bloqueado (mitigación BOLA)', async () => {
    const repo = crearMockRepo();
    const servicio = new ServicioRutaDoc(repo);

    const actorEspecialista: ActorRutaDoc = {
      id: 'usr-esp-1',
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: 'a0000000-0000-0000-0000-000000000001',
    };

    const filtrosInyeccion: FiltrosRutaDoc = {
      pestana: 'PENDIENTES',
      limite: 20,
      areaId: 'a0000000-0000-0000-0000-000000000002', // Dirección General
    };

    await expect(servicio.listar(filtrosInyeccion, actorEspecialista)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(repo.listar).not.toHaveBeenCalled();
  });

  it('7. Operador ESPECIALISTA sin unidad orgánica asignada falla cerrado (Fail-Closed)', async () => {
    const repo = crearMockRepo();
    const servicio = new ServicioRutaDoc(repo);

    const actorSinArea: ActorRutaDoc = {
      id: 'usr-esp-2',
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: null,
    };

    const filtros: FiltrosRutaDoc = { pestana: 'PENDIENTES', limite: 20 };
    await expect(servicio.listar(filtros, actorSinArea)).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    });
    expect(repo.listar).not.toHaveBeenCalled();
  });

  it('8. Operador ESPECIALISTA enviando explícitamente su propia área es admitido', async () => {
    const repo = crearMockRepo();
    const servicio = new ServicioRutaDoc(repo);

    const actorEspecialista: ActorRutaDoc = {
      id: 'usr-esp-1',
      roles: ['ESPECIALISTA'],
      unidadOrganicaId: 'a0000000-0000-0000-0000-000000000001',
    };

    const filtrosValidos: FiltrosRutaDoc = {
      pestana: 'PENDIENTES',
      limite: 20,
      areaId: 'a0000000-0000-0000-0000-000000000001',
    };

    await servicio.listar(filtrosValidos, actorEspecialista);
    expect(repo.listar).toHaveBeenCalledTimes(1);
    const filtrosEnviados = vi.mocked(repo.listar).mock.calls[0][0];
    expect(filtrosEnviados.areaId).toBe('a0000000-0000-0000-0000-000000000001');
  });
});
