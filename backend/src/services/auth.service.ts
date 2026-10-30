import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwt.js';
import { TEST_USERS, type PublicUser, type User } from '../models/User.js';

export interface AuthResult {
  accessToken: string;
  usuario: PublicUser;
}

function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, role, ...publicUser } = user;
  return { ...publicUser, rol: role };
}

export async function authenticateUser(
  identificador: string,
  password: string,
): Promise<AuthResult | null> {
  const normalizedIdentifier = identificador.trim().toLocaleLowerCase();
  const user = TEST_USERS.find(
    (candidate) =>
      candidate.username.toLocaleLowerCase() === normalizedIdentifier ||
      candidate.email.toLocaleLowerCase() === normalizedIdentifier,
  );

  const passwordValid = await bcrypt.compare(
    password,
    user?.passwordHash ?? TEST_USERS[0].passwordHash,
  );
  if (!user || !passwordValid) {
    return null;
  }

  const accessToken = jwt.sign(
    { rol: user.role, username: user.username },
    getJwtSecret(),
    { subject: user.id, expiresIn: '1h' },
  );

  return { accessToken, usuario: toPublicUser(user) };
}
