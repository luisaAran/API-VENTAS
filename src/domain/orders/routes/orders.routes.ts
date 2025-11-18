import { Router } from 'express';
import { OrdersController } from '../controllers/orders.controller';
import { OrdersService } from '../services/orders.service';
import { AuthService } from '../../auth/services/auth.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { validateZod } from '../../../shared/middlewares/validateZod';
import { requireAuth } from '../../../shared/middlewares/auth';
import {
  createOrderSchema,
  updateOrderSchema,
  getOrderByIdSchema,
  listOrdersSchema,
  deleteOrderSchema,
  cancelOrderByUserSchema,
} from '../validations/orders.validations';

export class OrdersRoutes {
  public readonly router: Router;
  private controller: OrdersController;

  constructor(service: OrdersService, authService: AuthService) {
    this.router = Router();
    this.controller = new OrdersController(service, authService);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @swagger
     * /api/orders:
     *   post:
     *     summary: Crear nueva orden
     *     tags: [Orders]
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - items
     *             properties:
     *               items:
     *                 type: array
     *                 items:
     *                   type: object
     *                   properties:
     *                     productId:
     *                       type: integer
     *                       example: 1
     *                     quantity:
     *                       type: integer
     *                       example: 2
     *     responses:
     *       201:
     *         description: Orden creada - requiere verificación por email
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 message:
     *                   type: string
     *                 order:
     *                   $ref: '#/components/schemas/Order'
     *       400:
     *         $ref: '#/components/responses/ValidationError'
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.post(
      '/',
      requireAuth(['user', 'admin']),
      validateZod(createOrderSchema),
      asyncHandler(this.controller.createOrder.bind(this.controller))
    );

    /**
     * @swagger
     * /api/orders:
     *   get:
     *     summary: Listar todas las órdenes (Solo Admin)
     *     tags: [Orders]
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [pending, completed, cancelled]
     *       - in: query
     *         name: userId
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Lista de órdenes
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items:
     *                 $ref: '#/components/schemas/Order'
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     *       403:
     *         $ref: '#/components/responses/ForbiddenError'
     */
    this.router.get(
      '/',
      requireAuth(['admin']),
      validateZod(listOrdersSchema),
      asyncHandler(this.controller.listAllOrders.bind(this.controller))
    );

    /**
     * @swagger
     * /api/orders/{id}:
     *   get:
     *     summary: Obtener orden por ID
     *     tags: [Orders]
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
     *         description: Orden encontrada
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Order'
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     *       404:
     *         $ref: '#/components/responses/NotFoundError'
     */
    this.router.get(
      '/:id',
      requireAuth(['user', 'admin']),
      validateZod(getOrderByIdSchema),
      asyncHandler(this.controller.getOrderById.bind(this.controller))
    );

    /**
     * @swagger
     * /api/orders/{id}:
     *   put:
     *     summary: Actualizar orden (Solo Admin)
     *     tags: [Orders]
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
     *               status:
     *                 type: string
     *                 enum: [pending, completed, cancelled]
     *     responses:
     *       200:
     *         description: Orden actualizada
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
      validateZod(updateOrderSchema),
      asyncHandler(this.controller.updateOrder.bind(this.controller))
    );

    /**
     * @swagger
     * /api/orders/{id}:
     *   delete:
     *     summary: Eliminar orden (Solo Admin)
     *     tags: [Orders]
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
     *         description: Orden eliminada
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
      validateZod(deleteOrderSchema),
      asyncHandler(this.controller.deleteOrder.bind(this.controller))
    );
    /**
     * @swagger
     * /api/orders/cancel:
     *   post:
     *     summary: Cancelar orden pendiente
     *     tags: [Orders]
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - orderId
     *             properties:
     *               orderId:
     *                 type: integer
     *                 example: 1
     *     responses:
     *       200:
     *         description: Orden cancelada exitosamente
     *       400:
     *         $ref: '#/components/responses/ValidationError'
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     *       404:
     *         $ref: '#/components/responses/NotFoundError'
     */
    this.router.post(
      '/cancel',
      requireAuth(['user', 'admin']),
      validateZod(cancelOrderByUserSchema),
      asyncHandler(this.controller.cancelOrderByUser.bind(this.controller))
    );
  }
}
