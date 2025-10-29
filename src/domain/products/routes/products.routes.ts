import { Router } from 'express';
import { ProductsController } from '../controllers/products.controller';
import { ProductsService } from '../services/products.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { validateZod } from '../../../shared/middlewares/validateZod';
import { requireAuth } from '../../../shared/middlewares/auth';
import { createProductSchema } from '../validations/products.validations';

export class ProductsRoutes {
  public readonly router: Router;
  private controller: ProductsController;

  constructor(service: ProductsService) {
    this.router = Router();
    this.controller = new ProductsController(service);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Protected route - requires authentication (both users and admins can list products)
    this.router.get(
      '/',
      requireAuth(['user', 'admin']), // Accepts both user and admin roles
      asyncHandler(this.controller.listProducts.bind(this.controller))
    );
    
    // Protected route - requires authentication (both users and admins can create products)
    this.router.post(
      '/',
      requireAuth(['user', 'admin']), // Accepts both user and admin roles
      validateZod(createProductSchema),
      asyncHandler(this.controller.createProduct.bind(this.controller))
    );
  }
}
