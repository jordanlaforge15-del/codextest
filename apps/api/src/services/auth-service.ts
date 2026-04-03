import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { User } from '@prisma/client';
import { HttpError } from '../errors/http-error.js';
import { createUser, getUserByEmail, getUserById } from '../repositories/user-repository.js';

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
  };
  token: string;
}

const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const scrypt = promisify(scryptCb);

function getAuthSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('AUTH_JWT_SECRET must be set');
  }

  return secret;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}

async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const [salt, stored] = passwordHash.split(':');
  if (!salt || !stored) {
    return false;
  }

  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const storedBuffer = Buffer.from(stored, 'hex');
  if (storedBuffer.length !== derived.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derived);
}

function buildToken(userId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  const signature = createHmac('sha256', getAuthSecret()).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

function parseToken(token: string): { userId: string; expiresAt: number } | null {
  const [userId, expiresAtRaw, signature] = token.split('.');
  if (!userId || !expiresAtRaw || !signature) {
    return null;
  }

  const payload = `${userId}.${expiresAtRaw}`;
  const expectedSignature = createHmac('sha256', getAuthSecret()).update(payload).digest('hex');
  const sigBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { userId, expiresAt };
}

function toAuthResponse(user: User): AuthResponse {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString()
    },
    token: buildToken(user.id)
  };
}

export async function signupService(input: { email: string; password: string; name?: string }): Promise<AuthResponse> {
  const existing = await getUserByEmail(input.email);
  if (existing) {
    throw new HttpError(409, 'Email is already registered');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await createUser({
    email: input.email,
    passwordHash,
    name: input.name || null
  });

  return toAuthResponse(user);
}

export async function loginService(input: { email: string; password: string }): Promise<AuthResponse> {
  const user = await getUserByEmail(input.email);
  if (!user) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new HttpError(401, 'Invalid email or password');
  }

  return toAuthResponse(user);
}

export async function meService(token: string): Promise<AuthResponse['user']> {
  const parsed = parseToken(token);
  if (!parsed) {
    throw new HttpError(401, 'Unauthorized');
  }

  const user = await getUserById(parsed.userId);
  if (!user) {
    throw new HttpError(401, 'Unauthorized');
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString()
  };
}
