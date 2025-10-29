import { ProductsRoutes } from './routes/products.routes';
import { ProductsService } from './services/products.service';

const service = new ProductsService();
const productsRoutes = new ProductsRoutes(service);

export const ProductsModule = {
  router: productsRoutes.router,
  service,
};
