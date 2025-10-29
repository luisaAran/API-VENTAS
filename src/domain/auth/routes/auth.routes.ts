import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { validateZod } from '../../../shared/middlewares/validateZod';
import {
  registerSchema,
  requestEmailVerificationSchema,
  verifyEmailSchema,
  loginSchema,
  verifyLoginCodeSchema,
} from '../validations/auth.validations';

export class AuthRoutes {
  public readonly router: Router;
  private controller: AuthController;

  constructor(authService: AuthService) {
    this.router = Router();
    this.controller = new AuthController(authService);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(
      '/register',
      validateZod(registerSchema),
      asyncHandler(this.controller.register.bind(this.controller))
    );
    this.router.post(
      '/request-email-verification',
      validateZod(requestEmailVerificationSchema),
      asyncHandler(this.controller.requestEmailVerification.bind(this.controller))
    );
    this.router.get(
      '/verify-email',
      validateZod(verifyEmailSchema),
      asyncHandler(this.controller.verifyEmail.bind(this.controller))
    ); // GET with ?token=xxx
    this.router.post(
      '/login',
      validateZod(loginSchema),
      asyncHandler(this.controller.requestLoginCode.bind(this.controller))
    ); // credentials -> send code
    this.router.post(
      '/verify-code',
      validateZod(verifyLoginCodeSchema),
      asyncHandler(this.controller.verifyLoginCode.bind(this.controller))
    ); // code -> tokens
    this.router.post('/refresh', asyncHandler(this.controller.refreshToken.bind(this.controller)));
  }
}
