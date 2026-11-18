/**
 * Claves canónicas TanStack Query v5 — Plan §2.2 (tuplas jerárquicas inmutables).
 * Núcleo aportado por F_ADRIANO (flujos académicos + validador CVD); el resto
 * de grupos extiende este objeto en sus propios módulos.
 */
export const queryKeys = {
  auth: {
    perfil: ["auth", "perfil"] as const,
  },
  flujos: {
    titulacion: {
      detalle: (tramiteId: number | string) =>
        ["flujos", "titulacion", "detalle", String(tramiteId)] as const,
      transiciones: (tramiteId: number | string) =>
        ["flujos", "titulacion", "transiciones", String(tramiteId)] as const,
    },
  },
  validador: {
    cvd: (codigo: string) => ["validador", "cvd", codigo] as const,
  },
} as const;
