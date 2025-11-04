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
    // READ operations - accessible by both users and admins
    this.router.get(
      '/',
      requireAuth(['user', 'admin']),
      validateZod(listProductsSchema),
      asyncHandler(this.controller.listProducts.bind(this.controller))
    );
    this.router.get(
      '/:id',
      requireAuth(['user', 'admin']),
      validateZod(getProductByIdSchema),
      asyncHandler(this.controller.getProductById.bind(this.controller))
    );
    // WRITE operations - only admins
    this.router.post(
      '/',
      requireAuth(['admin']),
      validateZod(createProductSchema),
      asyncHandler(this.controller.createProduct.bind(this.controller))
    );
    this.router.put(
      '/:id',
      requireAuth(['admin']),
      validateZod(updateProductSchema),
      asyncHandler(this.controller.updateProduct.bind(this.controller))
    );
    this.router.delete(
      '/:id',
      requireAuth(['admin']),
      validateZod(deleteProductSchema),
      asyncHandler(this.controller.deleteProduct.bind(this.controller))
    );
  }
}
