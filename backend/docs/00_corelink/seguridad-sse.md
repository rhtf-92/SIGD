# Seguridad de los streams SSE

`GET /api/v1/realtime/stream` exige un JWT vigente, una sesión no revocada y un
perfil activo. La autorización de cada evento se limita al identificador del
destinatario; los eventos sin destinatario explícito y los registros históricos
sin propietario no se publican ni se reproducen.

## JWT en la URL

El navegador nativo `EventSource` no permite establecer `Authorization`, por lo
que el frontend actual transmite el JWT en `?token=`. Los parámetros de URL
pueden quedar en historial del navegador, telemetría y logs de proxies o
balanceadores. Para reducir esa exposición, el endpoint responde con
`Cache-Control: no-store` y `Referrer-Policy: no-referrer`; los errores HTTP
registran y devuelven solo `req.path`, sin query string. La conexión se revalida
contra la sesión persistida cada 15 segundos y se cierra al revocarse.

En producción, servir siempre por TLS y configurar cada proxy, balanceador,
APM y sistema de analítica para omitir la query o redactar específicamente el
parámetro `token`. No registrar URLs completas de este endpoint. Estos controles
locales no pueden borrar valores que un intermediario externo ya haya guardado.

Como evolución, reemplazar el JWT de URL por un ticket SSE de corta duración,
de un solo uso y ligado a la sesión, emitido mediante una petición autenticada.
