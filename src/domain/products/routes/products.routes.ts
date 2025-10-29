import { Router } from 'express';
import { ProductsController } from '../controllers/products.controller';
import { ProductsService } from '../services/products.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { validateZod } from '../../../shared/middlewares/validateZod';
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
    this.router.post(
      '/',
      validateZod(createProductSchema),
      asyncHandler(this.controller.createProduct.bind(this.controller))
    );
    this.router.get('/', asyncHandler(this.controller.listProducts.bind(this.controller)));
  }
}
