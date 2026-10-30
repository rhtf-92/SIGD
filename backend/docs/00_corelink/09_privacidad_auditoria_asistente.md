# Datos y retención de auditoría del asistente

El asistente no persiste el texto plano de la consulta. Registra hashes SHA-256
sin sal del mensaje y la respuesta, además de intención, confianza, motor y el
identificador de sesión opcional. El hash es determinístico y no impide ataques
de diccionario; por tanto, estos datos son seudonimizados, no anónimos.

La bitácora general también conserva, en columnas separadas, el usuario
autenticado cuando existe, IP de origen, agente de usuario y correlation ID.
Estos metadatos pueden vincular un registro con una persona y deben protegerse
como datos personales. La migración de auditoría restringe la cuenta de
aplicación a INSERT/SELECT y la tabla rechaza UPDATE/DELETE mediante un trigger
WORM.

La aplicación no define una expiración ni un proceso de borrado para esa
bitácora. Por ser append-only, los registros pueden mantenerse indefinidamente
si la institución no establece y opera un ciclo de retención/archivo aprobado.
El responsable institucional debe definir el plazo y el tratamiento conforme
a la política de privacidad y auditoría aplicable; no se debe eludir la
inmutabilidad WORM mediante borrados desde la aplicación.
