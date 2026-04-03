import { Router, type Router as RouterType } from 'express';
import { HttpError } from '../errors/http-error.js';
import { loginSchema, signupSchema } from '../schemas/auth-schemas.js';
import { loginService, meService, signupService } from '../services/auth-service.js';

export const authRouter: RouterType = Router();

authRouter.post('/auth/signup', async (req, res, next) => {
  try {
    const payload = signupSchema.parse(req.body);
    const auth = await signupService(payload);
    res.status(201).json({ data: auth });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/auth/login', async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const auth = await loginService(payload);
    res.status(200).json({ data: auth });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/auth/me', async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;
    if (!token) {
      throw new HttpError(401, 'Unauthorized');
    }

    const user = await meService(token);
    res.status(200).json({ data: user });
  } catch (error) {
    next(error);
  }
});
