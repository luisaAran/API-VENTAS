import { Router } from 'express';
import { OrdersController } from '../controllers/orders.controller';
import { OrdersService } from '../services/orders.service';
import { AuthService } from '../../auth/services/auth.service';
import { asyncHandler } from '../../../shared/utils/asyncHandler';
import { validateZod } from '../../../shared/middlewares/validateZod';
import { requireAuth } from '../../../shared/middlewares/auth';
import {
  createOrderSchema,
  updateOrderSchema,
  getOrderByIdSchema,
  listOrdersSchema,
  deleteOrderSchema,
  cancelOrderByUserSchema,
} from '../validations/orders.validations';

export class OrdersRoutes {
  public readonly router: Router;
  private controller: OrdersController;

  constructor(service: OrdersService, authService: AuthService) {
    this.router = Router();
    this.controller = new OrdersController(service, authService);
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // CREATE - Both users and admins can create orders
    this.router.post(
      '/',
      requireAuth(['user', 'admin']),
      validateZod(createOrderSchema),
      asyncHandler(this.controller.createOrder.bind(this.controller))
    );

    // READ - Admins can see all orders with filters, users handled in /users/me endpoint
    this.router.get(
      '/',
      requireAuth(['admin']),
      validateZod(listOrdersSchema),
      asyncHandler(this.controller.listAllOrders.bind(this.controller))
    );

    this.router.get(
      '/:id',
      requireAuth(['user', 'admin']),
      validateZod(getOrderByIdSchema),
      asyncHandler(this.controller.getOrderById.bind(this.controller))
    );

    // UPDATE - Only admins
    this.router.put(
      '/:id',
      requireAuth(['admin']),
      validateZod(updateOrderSchema),
      asyncHandler(this.controller.updateOrder.bind(this.controller))
    );

    // DELETE - Only admins
    this.router.delete(
      '/:id',
      requireAuth(['admin']),
      validateZod(deleteOrderSchema),
      asyncHandler(this.controller.deleteOrder.bind(this.controller))
    );
    this.router.post(
      '/cancel',
      requireAuth(['user', 'admin']),
      validateZod(cancelOrderByUserSchema),
      asyncHandler(this.controller.cancelOrderByUser.bind(this.controller))
    );
  }
}
