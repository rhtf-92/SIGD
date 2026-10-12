# Hallazgo independiente: migración 06 de RutaDoc

## Alcance

Este documento registra un problema preexistente observado al ejecutar desde cero las migraciones del SIGD. No modifica `06_sigd_rut.sql`, `07_sigd_reportes.sql` ni código de RutaDoc o Reportes.

## Error reproducido

PostgreSQL detiene `06_sigd_rut.sql` con SQLSTATE `42703` porque una sentencia referencia `e.id_expediente`, mientras que el contrato creado previamente por `05_sigd_tra.sql` define la clave como `expediente_id`.

## Corrección propuesta para el responsable de RutaDoc

Revisar la consulta afectada y alinear la referencia con el nombre canónico `e.expediente_id`, verificando después todas las migraciones en una base vacía y las pruebas de RutaDoc/Reportes. La corrección debe realizarse en una rama y revisión propias del módulo, para evitar alterar funcionalidades ajenas desde este PR de OrganiCore/Administración.

## Estado en PR #166

- Migraciones 06 y 07: sin modificaciones respecto de `F_BARTRA`.
- Hallazgo: documentado únicamente para seguimiento.
- Migraciones nuevas de este PR: incrementales y limitadas al esquema de autenticación.
