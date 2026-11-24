import 'dotenv/config';
import { firmarTokenAcceso } from './src/core/auth/jwt.service.js';

console.log(
  firmarTokenAcceso({
    sub: '00000000-0000-0000-0000-000000000004',
    roles: ['DIRECTOR'],
    expiraSegundos: 3600,
  }),
);
