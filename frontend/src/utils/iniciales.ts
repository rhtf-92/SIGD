export function inicialesNombre(nombre?: string | null): string {
  if (!nombre?.trim()) return "U";
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((palabra) => palabra[0]?.toUpperCase() ?? "")
    .join("");
}