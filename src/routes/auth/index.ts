import express, { Router } from 'express';
import { signinRouter } from './login';
import { registerRouter } from './register';
import { changePasswordRouter } from './changepassword';

const authRoutes: Router = express.Router();

// Explicitly assign each router to its base path
authRoutes.use('/login', signinRouter);
authRoutes.use('/register', registerRouter);
authRoutes.use('/changePassword', changePasswordRouter);

export { authRoutes };
