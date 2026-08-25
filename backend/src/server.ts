import "dotenv/config";

import app from "./app.js";

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(
    "La variable de entorno PORT debe ser un número entero entre 1 y 65535.",
  );
}

app.listen(port, () => {
  console.log(`Servidor SIGD iniciado en el puerto ${port}`);
});
