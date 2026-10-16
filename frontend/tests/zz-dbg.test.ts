import { it } from "vitest";
import { buscarRespuesta, tokenizar } from "../src/hooks/useAsistenteIA";

it("dbg", () => {
  const casos = [
    "quiero hacer una solicitud",
    "donde presento un tramite con faltas: trmaite",
    "gracias",
  ];
  for (const q of casos) {
    console.log(
      JSON.stringify(q),
      "tokens=",
      JSON.stringify(tokenizar(q)),
      "=>",
      JSON.stringify(buscarRespuesta(q).temaId),
    );
  }
});
