import express, { Router } from 'express';
import { signinRouter } from './login';
import { registerRouter } from './register';
import { changePasswordRouter } from './changepassword';

const authRoutes: Router = express.Router();

// Use all auth routes
authRoutes.use(signinRouter, registerRouter, changePasswordRouter);

export { authRoutes };
