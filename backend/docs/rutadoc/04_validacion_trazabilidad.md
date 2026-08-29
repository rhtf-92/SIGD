# Validacion tecnica de la implementacion PostgreSQL de RutaDoc

- Responsable: Jhasy
- Rama: B_JHASY
- Grupo: Grupo 1 -- RutaDoc (Trazabilidad, recepcion, derivacion y atencion)
- SGBD de referencia: PostgreSQL 18.6
- Estado: IMPLEMENTACION TECNICA Y VALIDACION
- Validacion institucional: PENDIENTE

---

## 1. Proposito y alcance

Este documento presenta la justificacion tecnica, el diseno fisico en PostgreSQL 18.6 y las pruebas de validacion del modulo RutaDoc. Se fundamenta estrictamente en el analisis funcional aprobado de Liz (01_analisis_trazabilidad_recepcion_derivacion_atencion.md), en el modelo logico de Geric (02_modelo_datos_trazabilidad.md), en el diccionario de datos (02_diccionario_datos_trazabilidad.md) y en el registro de decisiones (05_decisiones_y_preguntas_pendientes.md).

### Objetivos tecnicos cumplidos:
1. Fidelidad al modelo: Implementar con exactitud las 12 entidades y 69 atributos aprobados, sin adiciones ni supresiones silenciosas.
2. Inmutabilidad historica: Garantizar mediante restricciones y disparadores (triggers) que los eventos historicos en movimiento_tramite no puedan ser modificados ni eliminados.
3. Proyeccion consistente: Automatizar la actualizacion de estado_actual_tramite a partir del historial sin convertirlo en una segunda fuente de verdad.
4. Respeto a contratos externos: Tratar las referencias a expedientes, usuarios, areas y documentos como identificadores tipados sin crear claves foraneas fisicas prematuras hacia tablas externas aun no disponibles.
5. Comprobacion de ciclo de vida: Validar la creacion limpia, carga de catalogos preliminares, insercion de casos academicos, consultas de reconstruccion y ejecucion de reversion (rollback).

---

## 2. Matriz fisica de entidades y atributos (12 Entidades / 69 Atributos)

A continuacion se detalla la correspondencia entre las 12 entidades y 69 atributos:

1. accion_tramite (7 atributos): accion_tramite_id (PK), codigo (UK), nombre, descripcion, activo, vigente_desde, vigente_hasta.
2. estado_tramite (8 atributos): estado_tramite_id (PK), codigo (UK), nombre, descripcion, es_terminal, activo, vigente_desde, vigente_hasta.
3. transicion_estado_tramite (8 atributos): transicion_estado_tramite_id (PK), estado_anterior_id (FK), accion_tramite_id (FK), estado_resultante_id (FK), condicion_descriptiva, activo, vigente_desde, vigente_hasta.
4. movimiento_tramite (12 atributos): movimiento_id (PK), expediente_id (REF G2), secuencia (UK), accion_tramite_id (FK), transicion_estado_tramite_id (FK), estado_anterior_id (FK), estado_resultante_id (FK), usuario_actor_id (REF G4), area_contexto_id (REF G3), fecha_hora, observacion, clave_idempotencia (UK).
5. derivacion_tramite (4 atributos): movimiento_id (PK/FK), area_origen_id (REF G3), area_destino_id (REF G3), motivo.
6. recepcion_tramite (4 atributos): movimiento_id (PK/FK), derivacion_movimiento_id (FK/UK), area_receptora_id (REF G3), observacion_recepcion.
7. observacion_tramite (3 atributos): movimiento_id (PK/FK), motivo, detalle.
8. atencion_tramite (2 atributos): movimiento_id (PK/FK), resultado_resumen.
9. tipo_relacion_movimiento (5 atributos): tipo_relacion_movimiento_id (PK), codigo (UK), nombre, descripcion, activo.
10. relacion_movimiento (6 atributos): relacion_movimiento_id (PK), movimiento_origen_id (FK), movimiento_destino_id (FK), tipo_relacion_movimiento_id (FK), motivo, registrado_en.
11. movimiento_documento (4 atributos): movimiento_id (FK), documento_id (REF G5), finalidad, version_documento_id (REF G5).
12. estado_actual_tramite (6 atributos): expediente_id (PK/REF G2), movimiento_actual_id (FK), estado_actual_id (FK), secuencia_actual, actualizado_en, version_proyeccion.

Total verificado: exactamente 12 entidades y 69 atributos.

---

## 3. Claves foraneas locales y referencias externas

Se implementaron 15 claves foraneas locales con ON DELETE RESTRICT para proteger la integridad referencial interna.
Las referencias externas a expedientes (Grupo 2), areas (Grupo 3), usuarios (Grupo 4) y documentos (Grupo 5) se mantienen como identificadores VARCHAR(64) sin REFERENCES fisicas a la espera de sus tablas propietarias.

---

## 4. Inmutabilidad, concurrencia y proyeccion

- Trigger trg_inmutabilidad_movimiento: impide UPDATE y DELETE sobre movimiento_tramite.
- Trigger trg_actualizar_estado_actual: proyecta atomicamente el estado actual hacia estado_actual_tramite ante cada INSERT.
- Triggers de compatibilidad: garantizan que los detalles especializados solo se vinculen con acciones permitidas.
- Idempotencia: UNIQUE (expediente_id, clave_idempotencia) previene duplicaciones por reintentos de red.

---

## 5. Rollback y desmontaje limpio

La Seccion 1 de 03_trazabilidad_movimientos.sql desmantela en orden inverso de dependencias triggers, funciones y tablas (CASCADE), asegurando una ejecucion limpia, repetible e idempotente.
