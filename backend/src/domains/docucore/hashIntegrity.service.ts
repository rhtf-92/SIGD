import { createHash, type Hash } from 'crypto';
import { Readable, Transform, type TransformCallback } from 'stream';

export interface HashResult {
  sha256: string;
  bytesProcessed: number;
}

/**
 * Calcula el digest SHA-256 de un flujo de bytes.
 *
 * IMPLEMENTACIÓN (DC-06):
 * Consume el stream mediante el iterador asíncrono (for await), que aplica
 * backpressure de forma nativa: no se pausa la lectura hasta que el hash
 * acepta el chunk. No se acumula ningun buffer en memoria; el contenido se
 * alimenta incrementally a crypto.createHash('sha256').
 *
 * ALCANCE DEL RESULTADO:
 * El digest corresponde EXCLUSIVAMENTE a los bytes leidos por este servicio.
 * Este modulo NO participa en la transmision a MinIO/S3, por lo que no puede
 * afirmar que el hash sea el de un objeto ya subido. Esa garantia requiere
 * integrar el calculo en la misma tuberia que alimenta el bucket.
 *
 * INTEGRACION CON EL ALMACENAMIENTO, a cargo del modulo de storage:
 *
 * El hashing Transform reenvia cada chunk intacto, de modo que puede
 * intercalarse en la misma tuberia que alimenta el bucket. Asi los bytes
 * hasheados y los bytes subidos son los mismos, sin necesidad de duplicar
 * el flujo:
 *
 *   const hashing = hashService.createHashStream();
 *   await pipeline(fuente, hashing, subirAMinIO(destino));
 *   const { sha256 } = await hashing.getResult();
 *
 * Si el modulo de storage necesitaUpload y hash como ramas independientes,
 * NO debe reutilizarse un unico PassThrough para ambas: un PassThrough tiene
 * un solo consumidor, de modo que la segunda rama se quedaria sin datos o
 * competederia con la primera. Para un fan-out real hacen falta dos ramas
 * independientes alimentadas desde el mismo origen (por ejemplo, con un
 * generador asincrono queYieldteea cada chunk a ambas), y hay que aceptar que
 * el hash entonces cubre lo que recibio la rama de hash, no necesariamente
 * lo que llego al bucket.
 *
 * MANEJO DE FALLOS:
 * Si cualquiera de los destinos falla, pipeline() destruye la tubereria y
 * las otras ramas se cancelan. El hash NO debe persistirse como valido en
 * ese escenario: el llamador debe confirmar la subida antes de registrar
 * el digest, ya que un hash sin objeto almacenado es evidencia inconsistente.
 */
export class HashIntegrityService {
  static readonly ALGORITHM = 'sha256';
  static readonly ENCODING = 'hex' as const;

  private static readonly CREAR_HASH = createHash;

  /**
   * Calcula el digest SHA-256 consumiendo el stream completo.
   *
   * Rechaza si el stream emite 'error' o se destruye antes de conclusion
   * normal (cierre prematuro / interrupcion).
   */
  async calculateFromStream(stream: Readable): Promise<HashResult> {
    const hash: Hash = HashIntegrityService.CREAR_HASH(HashIntegrityService.ALGORITHM);
    let bytesProcessed = 0;

    try {
      for await (const chunk of stream) {
        const trozo = chunk as Buffer;
        bytesProcessed += trozo.length;
        hash.update(trozo);
      }
    } catch (error) {
      // El iterador asincrono propaga tanto 'error' como el cierre prematuro.
      throw new Error(
        `Error calculando hash SHA-256 tras ${bytesProcessed} bytes: ${(error as Error).message}`,
        { cause: error },
      );
    }

    return {
      sha256: hash.digest(HashIntegrityService.ENCODING),
      bytesProcessed,
    };
  }

  /**
   * Stream transform que calcula el digest mientras reenvia los bytes.
   * Permite integrar el hash en la misma tuberia que alimenta MinIO/S3.
   *
   *   const hashing = hashService.createHashStream();
   *   await pipeline(fuente, hashing, destino);
   *   const { sha256, bytesProcessed } = await hashing.getResult();
   */
  createHashStream(): Transform & { getResult(): Promise<HashResult> } {
    const hash: Hash = HashIntegrityService.CREAR_HASH(HashIntegrityService.ALGORITHM);
    let bytesProcessed = 0;
    let concluido = false;

    let resolver!: (resultado: HashResult) => void;
    let rechazar!: (error: Error) => void;

    const resultado = new Promise<HashResult>((resolve, reject) => {
      resolver = resolve;
      rechazar = reject;
    });

    const flujo = new Transform({
      transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
        bytesProcessed += chunk.length;
        hash.update(chunk);
        callback(null, chunk);
      },
      flush(callback: TransformCallback) {
        concluido = true;
        resolver({
          sha256: hash.digest(HashIntegrityService.ENCODING),
          bytesProcessed,
        });
        callback();
      },
    });

    flujo.on('error', (error: Error) => {
      if (!concluido) {
        rechazar(new Error(`Error en el stream de hash: ${error.message}`, { cause: error }));
      }
    });

    return Object.assign(flujo, { getResult: () => resultado });
  }

  /**
   * Digest de un buffer ya disponible en memoria.
   *
   * ADVERTENCIA: cargar el archivo completo en memoria es precisamente el
   * defecto que DC-06 busca evitar (riesgo de OOM). Reservar para metadatos
   * pequenos, fixtures o pruebas. Para uploads grandes usar calculateFromStream.
   */
  calculateFromBuffer(buffer: Buffer): HashResult {
    const hash: Hash = HashIntegrityService.CREAR_HASH(HashIntegrityService.ALGORITHM);
    hash.update(buffer);
    return {
      sha256: hash.digest(HashIntegrityService.ENCODING),
      bytesProcessed: buffer.length,
    };
  }

  static validateHashFormat(hash: string): boolean {
    return /^[0-9a-f]{64}$/.test(hash);
  }
}