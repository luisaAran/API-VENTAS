import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { UsersService } from '../services/users.service';
import { ProductsService } from '../../products/services/products.service';
import { AuthService } from '../../auth/services/auth.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { requireAuth } from '../../../shared/middlewares/auth';
import { validateZod } from '../../../shared/middlewares/validateZod';
import { addBalanceSchema, updateUserSchema, deleteUserSchema } from '../validations/users.validations';

export class UsersRoutes {
  public readonly router: Router;
  private controller: UsersController;

  constructor(service: UsersService, productsService: ProductsService, authService: AuthService) {
    this.router = Router();
    this.controller = new UsersController(service, productsService, authService);
    this.initializeRoutes();
  }
  private initializeRoutes() {
    /**
     * @swagger
     * /api/users/me:
     *   get:
     *     summary: Obtener perfil del usuario autenticado
     *     tags: [Users]
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Perfil del usuario con órdenes
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 user:
     *                   $ref: '#/components/schemas/User'
     *                 orders:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Order'
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.get(
      '/me',
      requireAuth(['user', 'admin']),
      asyncHandler(this.controller.getMyProfile.bind(this.controller))
    );
    
    /**
     * @swagger
     * /api/users/me:
     *   patch:
     *     summary: Actualizar perfil del usuario
     *     tags: [Users]
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *               notifyBalanceUpdates:
     *                 type: boolean
     *     responses:
     *       200:
     *         description: Perfil actualizado
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.patch(
      '/me',
      requireAuth(['user', 'admin']),
      asyncHandler(this.controller.updateProfile.bind(this.controller))
    );
    
    /**
     * @swagger
     * /api/users/balance:
     *   post:
     *     summary: Agregar saldo a la cuenta del usuario
     *     tags: [Users]
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - amount
     *             properties:
     *               amount:
     *                 type: number
     *                 minimum: 0.01
     *                 example: 100.50
     *     responses:
     *       200:
     *         description: Saldo agregado exitosamente
     *       400:
     *         $ref: '#/components/responses/ValidationError'
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.post(
      '/balance',
      requireAuth(['user', 'admin']),
      validateZod(addBalanceSchema),
      asyncHandler(this.controller.addBalance.bind(this.controller))
    );
    
    /**
     * @swagger
     * /api/users:
     *   get:
     *     summary: Listar todos los usuarios (Solo Admin)
     *     tags: [Users]
     *     security:
     *       - cookieAuth: []
     *     responses:
     *       200:
     *         description: Lista de usuarios
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/User'
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     *       403:
     *         $ref: '#/components/responses/ForbiddenError'
     */
    this.router.get(
      '/',
      requireAuth(['admin']),
      asyncHandler(this.controller.listUsers.bind(this.controller))
    );

    /**
     * @swagger
     * /api/users/{id}:
     *   put:
     *     summary: Actualizar usuario (Solo Admin)
     *     tags: [Users]
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     requestBody:
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name:
     *                 type: string
     *               balance:
     *                 type: number
     *     responses:
     *       200:
     *         description: Usuario actualizado
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     *       403:
     *         $ref: '#/components/responses/ForbiddenError'
     *       404:
     *         $ref: '#/components/responses/NotFoundError'
     */
    this.router.put(
      '/:id',
      requireAuth(['admin']),
      validateZod(updateUserSchema),
      asyncHandler(this.controller.updateUser.bind(this.controller))
    );

    /**
     * @swagger
     * /api/users/{id}:
     *   delete:
     *     summary: Eliminar usuario - Soft Delete (Solo Admin)
     *     tags: [Users]
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Usuario eliminado (soft delete)
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     *       403:
     *         $ref: '#/components/responses/ForbiddenError'
     *       404:
     *         $ref: '#/components/responses/NotFoundError'
     */
    this.router.delete(
      '/:id',
      requireAuth(['admin']),
      validateZod(deleteUserSchema),
      asyncHandler(this.controller.deleteUser.bind(this.controller))
    );
  }
}
