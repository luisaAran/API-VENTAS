import { Request, Response } from 'express';
import { OrdersService } from '../services/orders.service';
import { AuthService } from '../../auth/services/auth.service';

export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private authService: AuthService
  ) {}

  async createOrder(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { items } = req.body as { items: Array<{ productId: number; quantity: number }> };
    let hasTrustedPayment = false;
    const trustedPaymentToken = req.cookies?.trustedPayment;
    if (trustedPaymentToken) {
      const validatedUserId = this.authService.validateTrustedPaymentToken(trustedPaymentToken);
      hasTrustedPayment = validatedUserId === userId;
    }
    const result = await this.ordersService.createOrder(userId, items, hasTrustedPayment);
    if (result.order) {
      const { user, ...orderData } = result.order;
      return res.status(201).json({
        ...result,
        order: orderData,
      });
    }
    return res.status(201).json(result);
  }
  async listAllOrders(req: Request, res: Response) {
    const { userId, status, minTotal, maxTotal } = req.query as {
      userId?: string;
      status?: 'pending' | 'completed' | 'cancelled';
      minTotal?: string;
      maxTotal?: string;
    };
    const filters = {
      userId: userId ? parseInt(userId, 10) : undefined,
      status,
      minTotal: minTotal ? parseFloat(minTotal) : undefined,
      maxTotal: maxTotal ? parseFloat(maxTotal) : undefined,
    };
    const orders = await this.ordersService.listAllOrders(filters);
    return res.json(orders);
  }
  async getOrderById(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const order = await this.ordersService.getOrderById(parseInt(id, 10));
    return res.json(order);
  }
  async updateOrder(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const { status, items } = req.body as {
      status?: 'pending' | 'completed' | 'cancelled';
      items?: Array<{ productId: number; quantity: number }>;
    };
    const order = await this.ordersService.updateOrder(parseInt(id, 10), { status, items });
    return res.json(order);
  }
  async deleteOrder(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const result = await this.ordersService.deleteOrder(parseInt(id, 10));
    return res.json(result);
  }

  async cancelOrderByUser(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { orderId } = req.body as { orderId: number };
    const result = await this.ordersService.cancelOrderByUser(orderId, userId);
    return res.json(result);
  }
}
