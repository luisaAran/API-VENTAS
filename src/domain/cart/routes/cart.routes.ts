import { Router } from 'express';
import { CartController } from '../controllers/cart.controller';
import { requireAuth, checkTrustedPayment } from '../../../shared/middlewares/auth';
import { validateZod } from '../../../shared/middlewares/validateZod';
import { addItemSchema, updateItemSchema, removeItemSchema } from '../validations/cart.validations';
import { asyncHandler } from '../../../shared/utils/asyncHandler';

export const createCartRouter = (controller: CartController): Router => {
  const router = Router();
  router.use(requireAuth());
  
  /**
   * @swagger
   * /api/cart:
   *   get:
   *     summary: Obtener carrito del usuario
   *     tags: [Cart]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Carrito del usuario
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Cart'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  router.get('/', asyncHandler(controller.getCart.bind(controller)));
  
  /**
   * @swagger
   * /api/cart/summary:
   *   get:
   *     summary: Obtener resumen del carrito con detalles de productos y totales
   *     tags: [Cart]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Resumen del carrito
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 items:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       product:
   *                         $ref: '#/components/schemas/Product'
   *                       quantity:
   *                         type: integer
   *                       subtotal:
   *                         type: number
   *                 total:
   *                   type: number
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  router.get('/summary', asyncHandler(controller.getCartSummary.bind(controller)));
  
  /**
   * @swagger
   * /api/cart/items:
   *   post:
   *     summary: Agregar producto al carrito
   *     tags: [Cart]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - productId
   *               - quantity
   *             properties:
   *               productId:
   *                 type: integer
   *                 example: 1
   *               quantity:
   *                 type: integer
   *                 minimum: 1
   *                 example: 2
   *     responses:
   *       200:
   *         description: Producto agregado al carrito
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       404:
   *         $ref: '#/components/responses/NotFoundError'
   */
  router.post(
    '/items',
    validateZod(addItemSchema),
    asyncHandler(controller.addItem.bind(controller))
  );
  
  /**
   * @swagger
   * /api/cart/items:
   *   put:
   *     summary: Actualizar cantidad de producto en el carrito
   *     tags: [Cart]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - productId
   *               - quantity
   *             properties:
   *               productId:
   *                 type: integer
   *                 example: 1
   *               quantity:
   *                 type: integer
   *                 minimum: 1
   *                 example: 3
   *     responses:
   *       200:
   *         description: Cantidad actualizada
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  router.put(
    '/items',
    validateZod(updateItemSchema),
    asyncHandler(controller.updateItemQuantity.bind(controller))
  );
  
  /**
   * @swagger
   * /api/cart/items:
   *   delete:
   *     summary: Eliminar producto del carrito
   *     tags: [Cart]
   *     security:
   *       - cookieAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - productId
   *             properties:
   *               productId:
   *                 type: integer
   *                 example: 1
   *     responses:
   *       200:
   *         description: Producto eliminado del carrito
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  router.delete(
    '/items',
    validateZod(removeItemSchema),
    asyncHandler(controller.removeItem.bind(controller))
  );
  
  /**
   * @swagger
   * /api/cart:
   *   delete:
   *     summary: Vaciar carrito completo
   *     tags: [Cart]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       200:
   *         description: Carrito vaciado exitosamente
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   */
  router.delete('/', asyncHandler(controller.clearCart.bind(controller)));
  
  /**
   * @swagger
   * /api/cart/checkout:
   *   post:
   *     summary: Crear orden desde el carrito
   *     description: Convierte el carrito en una orden. Si el usuario no tiene dispositivo de confianza, se enviará un email de verificación.
   *     tags: [Cart]
   *     security:
   *       - cookieAuth: []
   *     responses:
   *       201:
   *         description: Orden creada - puede requerir verificación por email
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
  router.post('/checkout', checkTrustedPayment, asyncHandler(controller.checkout.bind(controller)));
  
  return router;
};
