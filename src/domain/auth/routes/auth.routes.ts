import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthService } from '../services/auth.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { validateZod } from '../../../shared/middlewares/validateZod';
import { requireAuth } from '../../../shared/middlewares/auth';
import {
  registerSchema,
  requestEmailVerificationSchema,
  verifyEmailSchema,
  loginSchema,
  verifyLoginCodeSchema,
  logoutSchema,
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
    /**
     * @swagger
     * /api/auth/register:
     *   post:
     *     summary: Registrar nuevo usuario
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *               - email
     *               - password
     *             properties:
     *               name:
     *                 type: string
     *                 example: Juan Pérez
     *               email:
     *                 type: string
     *                 format: email
     *                 example: juan@example.com
     *               password:
     *                 type: string
     *                 minLength: 8
     *                 example: Password123!
     *     responses:
     *       201:
     *         description: Usuario registrado exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                   example: User registered successfully
     *                 user:
     *                   $ref: '#/components/schemas/User'
     *       400:
     *         $ref: '#/components/responses/ValidationError'
     *       409:
     *         $ref: '#/components/responses/ConflictError'
     */
    this.router.post(
      '/register',
      validateZod(registerSchema),
      asyncHandler(this.controller.register.bind(this.controller))
    );

    /**
     * @swagger
     * /api/auth/request-email-verification:
     *   post:
     *     summary: Solicitar verificación de email
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *                 example: juan@example.com
     *     responses:
     *       200:
     *         description: Email de verificación enviado
     *       404:
     *         $ref: '#/components/responses/NotFoundError'
     */
    this.router.post(
      '/request-email-verification',
      validateZod(requestEmailVerificationSchema),
      asyncHandler(this.controller.requestEmailVerification.bind(this.controller))
    );

    /**
     * @swagger
     * /api/auth/verify-email:
     *   get:
     *     summary: Verificar email con token
     *     tags: [Auth]
     *     parameters:
     *       - in: query
     *         name: token
     *         required: true
     *         schema:
     *           type: string
     *         description: Token de verificación enviado por email
     *     responses:
     *       200:
     *         description: Email verificado exitosamente
     *       400:
     *         $ref: '#/components/responses/ValidationError'
     */
    this.router.get(
      '/verify-email',
      validateZod(verifyEmailSchema),
      asyncHandler(this.controller.verifyEmail.bind(this.controller))
    );

    /**
     * @swagger
     * /api/auth/login:
     *   post:
     *     summary: Iniciar sesión (envía código 2FA)
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - password
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *                 example: juan@example.com
     *               password:
     *                 type: string
     *                 example: Password123!
     *               remember:
     *                 type: boolean
     *                 example: true
     *     responses:
     *       200:
     *         description: Código de verificación enviado por email
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.post(
      '/login',
      validateZod(loginSchema),
      asyncHandler(this.controller.requestLoginCode.bind(this.controller))
    );

    /**
     * @swagger
     * /api/auth/verify-code:
     *   post:
     *     summary: Verificar código 2FA y obtener tokens
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - code
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *                 example: juan@example.com
     *               code:
     *                 type: string
     *                 example: "123456"
     *     responses:
     *       200:
     *         description: Login exitoso, tokens configurados en cookies
     *         headers:
     *           Set-Cookie:
     *             schema:
     *               type: string
     *               example: accessToken=eyJhbGc...; HttpOnly; Secure
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.post(
      '/verify-code',
      validateZod(verifyLoginCodeSchema),
      asyncHandler(this.controller.verifyLoginCode.bind(this.controller))
    );

    /**
     * @swagger
     * /api/auth/refresh:
     *   post:
     *     summary: Refrescar token de acceso
     *     tags: [Auth]
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Token refrescado exitosamente
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.post('/refresh', asyncHandler(this.controller.refreshToken.bind(this.controller)));

    /**
     * @swagger
     * /api/auth/verify-order:
     *   get:
     *     summary: Verificar orden de compra con token
     *     tags: [Auth]
     *     parameters:
     *       - in: query
     *         name: token
     *         required: true
     *         schema:
     *           type: string
     *         description: Token de verificación de orden
     *       - in: query
     *         name: remember
     *         schema:
     *           type: boolean
     *         description: Recordar dispositivo para futuras compras
     *     responses:
     *       200:
     *         description: Orden verificada y completada
     *       400:
     *         $ref: '#/components/responses/ValidationError'
     */
    this.router.get(
      '/verify-order',
      asyncHandler(this.controller.verifyOrder.bind(this.controller))
    );

    /**
     * @swagger
     * /api/auth/notification-preferences:
     *   get:
     *     summary: Actualizar preferencias de notificaciones
     *     tags: [Auth]
     *     parameters:
     *       - in: query
     *         name: token
     *         required: true
     *         schema:
     *           type: string
     *       - in: query
     *         name: notify
     *         required: true
     *         schema:
     *           type: boolean
     *     responses:
     *       200:
     *         description: Preferencias actualizadas
     */
    this.router.get(
      '/notification-preferences',
      asyncHandler(this.controller.updateNotificationPreferences.bind(this.controller))
    );

    /**
     * @swagger
     * /api/auth/logout:
     *   post:
     *     summary: Cerrar sesión
     *     tags: [Auth]
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               forgetDevice:
     *                 type: boolean
     *                 example: false
     *                 description: Si es true, elimina el token de dispositivo confiable
     *     responses:
     *       200:
     *         description: Sesión cerrada exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                   example: Logged out successfully
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.post(
      '/logout',
      requireAuth(['user', 'admin']),
      validateZod(logoutSchema),
      asyncHandler(this.controller.logout.bind(this.controller))
    );
  }
}
