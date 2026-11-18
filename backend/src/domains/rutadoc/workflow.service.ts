import type { Pool, PoolClient } from 'pg';
import { WorkflowRepository } from './workflow.repository.js';
import type {
  CrearWorkflowDefinicionInput,
  CrearWorkflowVersionInput,
  DtoWorkflowDefinicion,
  DtoWorkflowInstancia,
  DtoWorkflowVersion,
} from './workflow.types.js';
import { NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';

export class WorkflowService {
  private readonly repository: WorkflowRepository;

  constructor(private readonly pool: Pool) {
    this.repository = new WorkflowRepository(pool);
  }

  async registrarDefinicion(
    input: CrearWorkflowDefinicionInput,
    clienteParam?: PoolClient,
  ): Promise<DtoWorkflowDefinicion> {
    if (!input.codigo || input.codigo.trim().length === 0) {
      throw new ValidationError({ message: 'El código de la definición de workflow es requerido.' });
    }
    if (!input.nombre || input.nombre.trim().length === 0) {
      throw new ValidationError({ message: 'El nombre de la definición de workflow es requerido.' });
    }

    return this.repository.crearDefinicion(
      {
        ...input,
        proveniencia: input.proveniencia ?? 'NO_DETERMINADO',
        fuenteOriginal: input.fuenteOriginal ?? 'NO_DETERMINADO',
        estadoHomologacion: input.estadoHomologacion ?? 'PENDIENTE_HOMOLOGACION',
      },
      clienteParam,
    );
  }

  async registrarVersion(
    input: CrearWorkflowVersionInput,
    clienteParam?: PoolClient,
  ): Promise<DtoWorkflowVersion> {
    if (!input.idWorkflow) {
      throw new ValidationError({ message: 'Se requiere idWorkflow para registrar la versión.' });
    }
    if (!input.version) {
      throw new ValidationError({ message: 'Se requiere número de versión.' });
    }
    if (!input.pasos || input.pasos.length === 0) {
      throw new ValidationError({ message: 'El workflow debe contener al menos un paso o nodo.' });
    }

    return this.repository.crearVersion(
      {
        ...input,
        proveniencia: input.proveniencia ?? 'NO_DETERMINADO',
        fuenteOriginal: input.fuenteOriginal ?? 'NO_DETERMINADO',
        estadoHomologacion: input.estadoHomologacion ?? 'PENDIENTE_HOMOLOGACION',
      },
      clienteParam,
    );
  }

  async asociarWorkflowAProcedimiento(
    idProcedimiento: string,
    idVersionWorkflow: string,
    clienteParam?: PoolClient,
  ): Promise<void> {
    const version = await this.repository.obtenerVersionPorId(idVersionWorkflow, clienteParam);
    if (!version) {
      throw new NotFoundError({ message: `La versión de workflow ${idVersionWorkflow} no existe.` });
    }
    await this.repository.asignarWorkflowAProcedimiento(idProcedimiento, idVersionWorkflow, clienteParam);
  }

  async vincularInstanciaExpediente(
    expedienteId: string,
    idProcedimiento: string,
    clienteParam?: PoolClient,
  ): Promise<DtoWorkflowInstancia | null> {
    // Buscar configuración explícita (NUNCA inferir por categoría TUPA)
    const versionWf = await this.repository.obtenerVersionPorProcedimiento(idProcedimiento, clienteParam);
    if (!versionWf) {
      // Procedimiento sin workflow explícito configurado: queda abierto a tramitación manual
      return null;
    }

    const totalPasos = versionWf.pasos.length;
    return this.repository.crearInstancia(expedienteId, versionWf.idVersion, totalPasos, clienteParam);
  }

  async obtenerInstanciaPorExpediente(
    expedienteId: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoWorkflowInstancia | null> {
    return this.repository.obtenerInstanciaPorExpediente(expedienteId, clienteParam);
  }

  async avanzarPasoExpediente(
    expedienteId: string,
    usuarioId: string,
    areaId: string,
    evento: string,
    detalle?: string,
    clienteParam?: PoolClient,
  ): Promise<void> {
    const instancia = await this.repository.obtenerInstanciaPorExpediente(expedienteId, clienteParam);
    if (!instancia || instancia.estadoInstancia !== 'EN_CURSO') {
      return;
    }

    const nuevoPaso = Math.min(instancia.pasoActual + 1, instancia.totalPasos);
    const esFinal = nuevoPaso >= instancia.totalPasos && evento === 'CIERRE';

    await this.repository.avanzarPaso(
      expedienteId,
      nuevoPaso,
      {
        paso: instancia.pasoActual,
        completadoEn: new Date().toISOString(),
        usuarioId,
        areaId,
        evento,
        detalle,
      },
      esFinal,
      clienteParam,
    );
  }
}
