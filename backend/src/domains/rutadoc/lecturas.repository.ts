import type { Pool } from 'pg';
import { RepositorioPostgresFoliacionRutaDoc } from './foliacion.repository.js';
import { RepositorioPostgresTrazabilidadRutaDoc } from './trazabilidad.repository.js';

export { RepositorioPostgresFoliacionRutaDoc, RepositorioPostgresTrazabilidadRutaDoc };

/** Agrupador local para mantener la composición del router pequeña y explícita. */
export function crearRepositoriosLecturaRutaDoc(pool: Pool) {
  return {
    foliacion: new RepositorioPostgresFoliacionRutaDoc(pool),
    trazabilidad: new RepositorioPostgresTrazabilidadRutaDoc(pool),
  };
}
