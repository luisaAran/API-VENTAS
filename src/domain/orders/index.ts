import { OrdersService } from './services/orders.service';
import { OrdersRoutes } from './routes/orders.routes';
import { OrderRepository } from './repositories/order.repository';
import { UsersModule } from '../users';
import { AuthModule } from '../auth';

const orderRepository = new OrderRepository();
const ordersService = new OrdersService(orderRepository, UsersModule.service);
const ordersRoutes = new OrdersRoutes(ordersService, AuthModule.service);

export const OrdersModule = {
  router: ordersRoutes.router,
  service: ordersService,
  repository: orderRepository,
};
