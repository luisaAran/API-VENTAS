import { UsersRoutes } from './routes/users.routes';
import { UsersService } from './services/users.service';

const service = new UsersService();
const usersRoutes = new UsersRoutes(service);

export const UsersModule = {
  router: usersRoutes.router,
  service,
};
