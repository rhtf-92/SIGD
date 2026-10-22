export function getJwtSecret(): string {
  const JWT_SECRET = process.env.JWT_SECRET ?? process.env.AUTH_JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET.trim().length < 32) {
    throw new Error('JWT_SECRET debe configurarse con al menos 32 caracteres.');
  }
  return JWT_SECRET;
}
