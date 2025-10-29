import { Router } from 'express';
import { UsersController } from '../controllers/users.controller';
import { UsersService } from '../services/users.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { requireAuth } from '../../../shared/middlewares/auth';

export class UsersRoutes {
  public readonly router: Router;
  private controller: UsersController;

  constructor(service: UsersService) {
    this.router = Router();
    this.controller = new UsersController(service);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Protected route - only admins can list all users
    this.router.get(
      '/',
      requireAuth(['admin']),
      asyncHandler(this.controller.listUsers.bind(this.controller))
    );
  }
}
