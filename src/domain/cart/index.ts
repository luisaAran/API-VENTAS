import { CartRepository } from './repositories/cart.repository';
import { CartService } from './services/cart.service';
import { CartController } from './controllers/cart.controller';
import { createCartRouter } from './routes/cart.routes';
import { ProductsModule } from '../products';
import { OrdersModule } from '../orders';

// Initialize repository
const cartRepository = new CartRepository();

// Initialize service with dependencies
const cartService = new CartService(
  cartRepository,
  ProductsModule.service,
  OrdersModule.service
);

// Initialize controller
const cartController = new CartController(cartService);

// Create router
const cartRouter = createCartRouter(cartController);

// Export module
export const CartModule = {
  repository: cartRepository,
  service: cartService,
  controller: cartController,
  router: cartRouter,
};

// Export types
export * from './models/Cart';
