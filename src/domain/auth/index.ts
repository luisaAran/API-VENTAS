import { UsersModule } from '../users';
import { AuthRoutes } from './routes/auth.routes';
import { AuthService } from './services/auth.service';
// Import OrdersModule dynamically to avoid circular dependency
let ordersServiceInstance: any = null;
const service = new AuthService(UsersModule.service);
const authRoutes = new AuthRoutes(service);
// Setter to inject OrdersService after initialization to avoid circular dependency
export function setOrdersService(ordersService: any) {
  ordersServiceInstance = ordersService;
  // Update the service instance with OrdersService
  (service as any).ordersService = ordersService;
}
export const AuthModule = {
  router: authRoutes.router,
  service,
};
