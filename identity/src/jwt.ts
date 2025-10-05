import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './env.js';

export function sign(payload: any, expSeconds = 3600) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: expSeconds });
}

export function verifyToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as any;
}
