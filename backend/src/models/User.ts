export type UserRole = 'SUPER_ADMIN' | 'MESA_PARTES' | 'ESTUDIANTE';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
}

export type PublicUser = Omit<User, 'passwordHash' | 'role'> & { rol: UserRole };

export const TEST_USERS: readonly User[] = [
  {
    id: 'demo-admin',
    username: 'admin.demo',
    email: 'admin.demo@iestp-suiza.edu.pe',
    name: 'Administrador de prueba',
    role: 'SUPER_ADMIN',
    passwordHash: '$2b$10$66pASjvc3A1BNriw9rW0rerjl1mLYZ.WR6MfOGu0jmcTYjN9.Rcza',
  },
  {
    id: 'clider',
    username: 'clider',
    email: 'clider@iestp-suiza.edu.pe',
    name: 'Clider',
    role: 'SUPER_ADMIN',
    passwordHash: '$2b$10$tqqywNq21SCN.6Lq223CA.ACGO7b2kHyUNSu5vSoTZoSMLe0m4Gg6',
  },
  {
    id: 'demo-mesa-partes',
    username: 'mesa.demo',
    email: 'mesa.demo@iestp-suiza.edu.pe',
    name: 'Operador de prueba',
    role: 'MESA_PARTES',
    passwordHash: '$2b$10$WKfsXQBPvLDxoMr60zFy4.NOVwPIJyUKD/efpthNIzdmXLjjEUkI6',
  },
  {
    id: 'demo-estudiante',
    username: 'estudiante.demo',
    email: 'estudiante.demo@iestp-suiza.edu.pe',
    name: 'Estudiante de prueba',
    role: 'ESTUDIANTE',
    passwordHash: '$2b$10$hQDINcAOm7a1aD5cMfV.MOxjnfY7KdNt7UJh8dRB7Phg54Mg08ytK',
  },
];

export function esRolUsuario(value: unknown): value is UserRole {
  return value === 'SUPER_ADMIN' || value === 'MESA_PARTES' || value === 'ESTUDIANTE';
}
