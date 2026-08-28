# Validación de Registro y Pruebas (Fase 5)

## 1. Orden de Ejecución
1. Conexión a la base de datos limpia de PostgreSQL 18.6.
2. Ejecución secuencial de `03_tramite_expediente_registro.sql`.

## 2. Pruebas de Restricción y Concurrencia
- **Generación de ID Seguro:** Uso de `GENERATED ALWAYS AS IDENTITY` para prevenir colisiones en llamadas concurrentes.
- **Unicidad:** Validación de códigos duplicados (`codigo_expediente`, `numero_registro`).
- **Anulación Conservando Registro:** Los registros anulados mantienen `anulado = true` sin borrar el historial.

```sql
-- Consulta de verificación general
SELECT e.codigo_expediente, a.numero_registro, t.estado, t.anulado 
FROM tramite t
JOIN expediente e ON t.id_expediente = e.id_expediente
LEFT JOIN asiento_registro a ON t.id_asiento = a.id_asiento;