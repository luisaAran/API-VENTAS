import { Router } from 'express';
import { ProductsController } from '../controllers/products.controller';
import { ProductsService } from '../services/products.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { validateZod } from '../../../shared/middlewares/validateZod';
import { requireAuth } from '../../../shared/middlewares/auth';
import {
  createProductSchema,
  updateProductSchema,
  getProductByIdSchema,
  listProductsSchema,
  deleteProductSchema,
} from '../validations/products.validations';

export class ProductsRoutes {
  public readonly router: Router;
  private controller: ProductsController;

  constructor(service: ProductsService) {
    this.router = Router();
    this.controller = new ProductsController(service);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    /**
     * @swagger
     * /api/products:
     *   get:
     *     summary: Listar productos con filtros y paginación
     *     tags: [Products]
     *     security:
     *       - cookieAuth: []
     *     parameters:
     *       - in: query
     *         name: search
     *         schema:
     *           type: string
     *         description: Búsqueda por nombre o descripción
     *       - in: query
     *         name: minPrice
     *         schema:
     *           type: number
     *       - in: query
     *         name: maxPrice
     *         schema:
     *           type: number
     *       - in: query
     *         name: inStock
     *         schema:
     *           type: boolean
     *       - in: query
     *         name: page
     *         schema:
     *           type: integer
     *           default: 1
     *       - in: query
     *         name: limit
     *         schema:
     *           type: integer
     *           default: 10
     *     responses:
     *       200:
     *         description: Lista de productos
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 products:
     *                   type: array
     *                   items:
     *                     $ref: '#/components/schemas/Product'
     *                 total:
     *                   type: integer
     *                 page:
     *                   type: integer
     *                 limit:
     *                   type: integer
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     */
    this.router.get(
      '/',
      requireAuth(['user', 'admin']),
      validateZod(listProductsSchema),
      asyncHandler(this.controller.listProducts.bind(this.controller))
    );
    /**
     * @swagger
     * /api/products/{id}:
     *   get:
     *     summary: Obtener producto por ID
     *     tags: [Products]
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
     *         description: Producto encontrado
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Product'
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     *       404:
     *         $ref: '#/components/responses/NotFoundError'
     */
    this.router.get(
      '/:id',
      requireAuth(['user', 'admin']),
      validateZod(getProductByIdSchema),
      asyncHandler(this.controller.getProductById.bind(this.controller))
    );
    /**
     * @swagger
     * /api/products:
     *   post:
     *     summary: Crear nuevo producto (Solo Admin)
     *     tags: [Products]
     *     security:
     *       - cookieAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - name
     *               - price
     *               - stock
     *             properties:
     *               name:
     *                 type: string
     *                 example: Laptop HP Pavilion 15
     *               description:
     *                 type: string
     *                 example: Laptop 15.6 pulgadas, 8GB RAM, 256GB SSD
     *               price:
     *                 type: number
     *                 example: 899.99
     *               stock:
     *                 type: integer
     *                 example: 50
     *     responses:
     *       201:
     *         description: Producto creado exitosamente
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Product'
     *       400:
     *         $ref: '#/components/responses/ValidationError'
     *       401:
     *         $ref: '#/components/responses/UnauthorizedError'
     *       403:
     *         $ref: '#/components/responses/ForbiddenError'
     */
    this.router.post(
      '/',
      requireAuth(['admin']),
      validateZod(createProductSchema),
      asyncHandler(this.controller.createProduct.bind(this.controller))
    );
    /**
     * @swagger
     * /api/products/{id}:
     *   put:
     *     summary: Actualizar producto (Solo Admin)
     *     tags: [Products]
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
     *               description:
     *                 type: string
     *               price:
     *                 type: number
     *               stock:
     *                 type: integer
     *     responses:
     *       200:
     *         description: Producto actualizado
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Product'
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
      validateZod(updateProductSchema),
      asyncHandler(this.controller.updateProduct.bind(this.controller))
    );
    /**
     * @swagger
     * /api/products/{id}:
     *   delete:
     *     summary: Eliminar producto (Solo Admin)
     *     tags: [Products]
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
     *         description: Producto eliminado exitosamente
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
      validateZod(deleteProductSchema),
      asyncHandler(this.controller.deleteProduct.bind(this.controller))
    );
  }
}
