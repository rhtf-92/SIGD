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

Se implementaron 18 restricciones de clave foranea locales con `ON DELETE RESTRICT`. El conteo considera cada restriccion fisica, incluida la FK compuesta de cuatro columnas que garantiza conjuntamente expediente, movimiento, estado y secuencia en la proyeccion.
Las referencias externas a expedientes (Grupo 2), areas (Grupo 3), usuarios (Grupo 4) y documentos (Grupo 5) se mantienen como identificadores VARCHAR(64) sin REFERENCES fisicas a la espera de sus tablas propietarias.

---

## 4. Inmutabilidad, concurrencia y proyeccion

- Trigger trg_inmutabilidad_movimiento: impide UPDATE y DELETE sobre movimiento_tramite.
- Trigger trg_actualizar_estado_actual: proyecta atomicamente el estado actual hacia estado_actual_tramite ante cada INSERT.
- Triggers de compatibilidad: garantizan que los detalles especializados solo se vinculen con acciones permitidas.
- Idempotencia condicionada: `UNIQUE (expediente_id, clave_idempotencia)` previene duplicaciones solamente cuando el emisor proporciona una `clave_idempotencia` no nula. Si se omite, PostgreSQL admite varios valores nulos y no existe garantia de idempotencia.

---

## 5. Instalacion, rollback y seguridad de pruebas

`03_trazabilidad_movimientos.sql` es un script de instalacion para un esquema vacio. No ejecuta `DROP TABLE`, no usa `CASCADE` y no debe presentarse como idempotente para esquemas ya instalados.

La limpieza o el rollback quedan fuera del flujo normal. Solo un operador puede desmontar objetos despues de verificar expresamente que la conexion apunta a una base desechable de pruebas. En esta validacion se elimino y recreo exclusivamente `rutadoc_pr22_test`, alojada en un cluster temporal independiente sobre `127.0.0.1:55432`. No se uso la base principal.

## 6. Reglas fisicas implementadas

- La transicion indicada por un movimiento debe coincidir con estado anterior, accion y estado resultante, estar activa y ser vigente en `fecha_hora`.
- La secuencia debe comenzar en 1, avanzar sin saltos y conservar como estado anterior el ultimo resultado del expediente. Un bloqueo transaccional por expediente evita carreras de insercion.
- Una recepcion derivada debe apuntar a una derivacion o devolucion anterior del mismo expediente; el area receptora debe coincidir con el destino y una derivacion solo puede confirmarse una vez.
- Un cierre requiere una atencion anterior con detalle en `atencion_tramite`.
- Una reapertura requiere, antes del `COMMIT`, una relacion `REABRE` hacia un cierre anterior del mismo expediente.
- Una rectificacion requiere, antes del `COMMIT`, una relacion `RECTIFICA` hacia el movimiento original anterior del mismo expediente.
- Las relaciones historicas son inmutables y no admiten autorrelacion.
- La FK compuesta de `estado_actual_tramite` impide que la proyeccion combine un expediente con un movimiento, estado o secuencia ajenos.
- La exclusion por rango `[vigente_desde, vigente_hasta)` permite versiones historicas adyacentes y rechaza periodos solapados para la misma transicion. Los extremos nulos representan infinito.

Estas reglas aplican sobre catalogos y matrices que siguen siendo **EJEMPLOS PROPUESTOS PARA PRUEBAS**. No constituyen valores ni reglas institucionales oficiales.

## 7. Entorno y ejecucion real

- Fecha de ejecucion: 2026-08-29.
- Motor: PostgreSQL 18 local.
- Cluster: temporal y aislado dentro del workspace, autenticacion local de prueba, puerto `55432`.
- Base: `rutadoc_pr22_test`, creada vacia y recreada antes de la corrida final.
- Credenciales: no se probaron contrasenas ni se guardaron credenciales en scripts.
- Ejecucion: `psql -w -X -v ON_ERROR_STOP=1 -f backend/docs/rutadoc/03_trazabilidad_movimientos.sql`.
- Resultado: `COMMIT`, 12 sentencias `CREATE TABLE`, carga de 13 acciones, 10 estados, 5 tipos de relacion y 13 transiciones propuestas; cero errores.
- Verificacion estructural obtenida: 12 tablas, 69 atributos y 18 restricciones FK.

## 8. Pruebas ejecutadas

Todas las operaciones se ejecutaron con `ON_ERROR_STOP`. Una prueba negativa solo se considero conforme cuando se obtuvo y verifico el error previsto. Los identificadores `EXP-*`, `AREA-*` y `USR-TEST` son datos ficticios.

### 8.1 Tramite sencillo

- Preparacion: base recien instalada y expediente ficticio `EXP-SIMPLE` sin movimientos.
- Operacion ejecutada: registro externo con secuencia 1 y recepcion inicial con secuencia 2 y detalle de recepcion.
- Resultado esperado: historial de dos movimientos y proyeccion en secuencia 2, estado `RECIBIDO`.
- Resultado obtenido: ambos movimientos se insertaron y la proyeccion quedo en secuencia 2.
- Evidencia: `PRUEBA 01 tramite sencillo: CONFORME (2 movimientos, estado RECIBIDO)`.

### 8.2 Varias derivaciones

- Preparacion: `EXP-MAIN` llevado hasta `EN_REVISION`.
- Operacion ejecutada: derivacion A-B, recepcion en B, nueva revision, derivacion B-C y recepcion en C.
- Resultado esperado: dos derivaciones distintas, cada una confirmada por su recepcion valida.
- Resultado obtenido: dos detalles de derivacion y dos recepciones vinculadas, sin errores.
- Evidencia: `PRUEBA 02 varias derivaciones: CONFORME (2 derivaciones y 2 recepciones vinculadas)`.

### 8.3 Devolucion

- Preparacion: `EXP-MAIN` recibido en C y llevado nuevamente a revision.
- Operacion ejecutada: devolucion C-B y recepcion posterior en B vinculada con esa devolucion.
- Resultado esperado: traslado de retorno conservado como movimiento y recepcion valida en destino.
- Resultado obtenido: devolucion y recepcion vinculadas fueron aceptadas.
- Evidencia: `PRUEBA 03 devolucion: CONFORME (devolucion y recepcion vinculadas)`.

### 8.4 Atencion final

- Preparacion: `EXP-MAIN` recibido en B.
- Operacion ejecutada: revision, inicio de atencion, atencion con `resultado_resumen` y cierre.
- Resultado esperado: cierre aceptado solamente despues de existir la atencion valida.
- Resultado obtenido: atencion con detalle y cierre posterior insertados correctamente.
- Evidencia: `PRUEBA 04 atencion final: CONFORME (atencion con detalle y cierre posterior)`.

### 8.5 Reconstruccion cronologica

- Preparacion: historial completo de `EXP-MAIN` generado por las pruebas 2 a 4.
- Operacion ejecutada: conteo, minimo, maximo y cantidad distinta de `secuencia` ordenada por expediente.
- Resultado esperado: 15 movimientos con secuencias contiguas y unicas de 1 a 15.
- Resultado obtenido: total 15, minimo 1, maximo 15 y 15 secuencias distintas.
- Evidencia: `PRUEBA 05 reconstruccion cronologica: CONFORME (secuencias 1..15 sin duplicados)`.

### 8.6 Destino invalido

- Preparacion: derivacion de `EXP-DEST-INVALIDO` desde A hacia B.
- Operacion ejecutada: intento de recepcion vinculado a esa derivacion indicando area receptora C.
- Resultado esperado: rechazo por no coincidir recepcion y destino.
- Resultado obtenido: excepcion `El area receptora debe coincidir con el destino de la derivacion`; el subbloque fue revertido.
- Evidencia: `PRUEBA 06 destino invalido: CONFORME (rechazado: area receptora no coincide)`.

### 8.7 Transicion no permitida

- Preparacion: expediente nuevo y seleccion de una transicion inicial propuesta.
- Operacion ejecutada: intento de usar esa transicion con un estado resultante diferente.
- Resultado esperado: rechazo por incompatibilidad entre la regla y el movimiento.
- Resultado obtenido: excepcion `La transicion indicada no es compatible, activa o vigente`.
- Evidencia: `PRUEBA 07 transicion no permitida: CONFORME (rechazada por incompatibilidad)`.

### 8.8 Derivacion duplicada

- Preparacion: una derivacion de `EXP-DUP` ya confirmada por una recepcion.
- Operacion ejecutada: intento de registrar una segunda recepcion usando el mismo `derivacion_movimiento_id`.
- Resultado esperado: rechazo por unicidad de la recepcion confirmatoria.
- Resultado obtenido: `unique_violation`; la segunda recepcion fue revertida.
- Evidencia: `PRUEBA 08 derivacion duplicada: CONFORME (segunda recepcion rechazada por unicidad)`.

### 8.9 Cierre sin atencion

- Preparacion: `EXP-SIN-ATENCION` en revision, sin movimiento ni detalle de atencion.
- Operacion ejecutada: intento de insertar una accion `CIERRE`.
- Resultado esperado: rechazo antes de registrar el cierre.
- Resultado obtenido: excepcion `No se puede cerrar un expediente sin una atencion valida anterior`.
- Evidencia: `PRUEBA 09 cierre sin atencion: CONFORME (rechazado)`.

### 8.10 Conflicto de secuencia

- Preparacion: `EXP-SECUENCIA` con un unico movimiento de secuencia 1.
- Operacion ejecutada: intento de insertar directamente la secuencia 3.
- Resultado esperado: rechazo porque correspondia la secuencia 2.
- Resultado obtenido: excepcion de conflicto con valores esperado 2 y recibido 3.
- Evidencia: `PRUEBA 10 conflicto de secuencia: CONFORME (se esperaba 2 y se rechazo 3)`.

### 8.11 Autorrelacion

- Preparacion: un movimiento valido de `EXP-AUTORREL`.
- Operacion ejecutada: intento de usar el mismo `movimiento_id` como origen y destino de una relacion.
- Resultado esperado: rechazo por `ck_relacion_movimientos_distintos` y validacion equivalente del trigger.
- Resultado obtenido: `check_violation`; no se creo la relacion.
- Evidencia: `PRUEBA 11 autorrelacion: CONFORME (rechazada por CHECK)`.

### 8.12 Rectificacion

- Preparacion: `EXP-RECTIFICA` en revision y conservacion del identificador del movimiento original.
- Operacion ejecutada: nuevo movimiento `RECTIFICACION` seguido, en la misma transaccion, por relacion `RECTIFICA` hacia el original.
- Resultado esperado: aceptar el movimiento posterior sin modificar ni borrar el original y satisfacer la relacion diferida.
- Resultado obtenido: movimiento y relacion aceptados al forzar la comprobacion diferida.
- Evidencia: `PRUEBA 12 rectificacion: CONFORME (movimiento posterior relacionado con original)`.

### 8.13 Reapertura

- Preparacion: `EXP-REABRE` atendido y cerrado; se conservo el identificador del cierre.
- Operacion ejecutada: movimiento `REAPERTURA` y relacion `REABRE` hacia el cierre anterior dentro de la misma transaccion.
- Resultado esperado: reapertura aceptada solo con cierre anterior del mismo expediente y relacion obligatoria.
- Resultado obtenido: movimiento y relacion aceptados; la validacion diferida termino conforme.
- Evidencia: `PRUEBA 13 reapertura: CONFORME (reapertura vinculada con cierre anterior)`.

## 9. Controles adicionales de integridad

- Modelo: `INTEGRIDAD modelo: CONFORME (12 tablas, 69 atributos, 18 restricciones FK)`.
- Proyeccion cruzada: una combinacion expediente/movimiento ajena produjo `foreign_key_violation` y se registro `INTEGRIDAD proyeccion: CONFORME`.
- Vigencia: una segunda version con rango solapado produjo `exclusion_violation` y se registro `INTEGRIDAD vigencia: CONFORME`.
- Relacion obligatoria: una rectificacion sin `RECTIFICA` fallo al comprobar el trigger diferido y se registro `INTEGRIDAD relacion obligatoria: CONFORME`.

## 10. Resultado global

Ejecucion final: **13/13 pruebas conformes**, mas 4/4 controles adicionales de integridad conformes. Este resultado valida la implementacion tecnica propuesta; no convierte los catalogos, transiciones ni criterios pendientes en decisiones institucionales oficiales.
