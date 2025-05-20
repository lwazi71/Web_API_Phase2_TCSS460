import express, { Router } from 'express';
import { signinRouter } from './login';
import { registerRouter } from './register';
import { changePasswordRouter } from './changepassword';

const authRoutes: Router = express.Router();

// Explicitly assign each router to its base path
authRoutes.use(signinRouter);
authRoutes.use(registerRouter);
authRoutes.use(changePasswordRouter);

export { authRoutes };
