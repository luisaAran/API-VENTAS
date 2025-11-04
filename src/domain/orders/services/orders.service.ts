import { Order } from '../models/Order';
import { OrderItem } from '../models/OrderItem';
import { Product } from '../../products/models/Product';
import { NotFoundError, ValidationError } from '../../../shared/errors';
import { OrderRepository } from '../repositories/order.repository';
import { UsersService } from '../../users/services/users.service';
import jwt from 'jsonwebtoken';
import { config as appConfig } from '../../../shared/config';
import { sendMail } from '../../../shared/utils/mailer';
import { EmailTemplates } from '../../../shared/templates';
import { PDFGenerator } from '../../../shared/utils/pdfGenerator';
import logger from '../../../shared/utils/logger';

export class OrdersService {
  constructor(
    private orderRepository: OrderRepository,
    private usersService: UsersService
  ) {}
  async createOrder(
    userId: number,
    items: Array<{ productId: number; quantity: number }>,
    hasTrustedPayment: boolean = false
  ) {
    if (!hasTrustedPayment) {
      const pendingOrdersCount = await this.orderRepository.countPendingOrdersByUserId(userId);
      if (pendingOrdersCount >= 5) {
        throw new ValidationError(
          'Has alcanzado el límite máximo de 5 órdenes pendientes. Por favor, verifica o cancela alguna orden antes de crear una nueva.'
        );
      }
    }
    const productIds = items.map(item => item.productId);
    const [user, products] = await Promise.all([
      this.usersService.findById(userId),
      this.orderRepository.findProductsByIds(productIds),
    ]);
    if (!user) {
      throw new NotFoundError('User');
    }
    const productMap = new Map<number, Product>();
    products.forEach((product: Product | null, index: number) => {
      if (product) {
        productMap.set(productIds[index], product);
      }
    });
    const orderItems: OrderItem[] = [];
    let total = 0;
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new NotFoundError(`Product with ID ${item.productId}`);
      }
      if (product.stock < item.quantity) {
        throw new ValidationError(
          `Insufficient stock for product "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`
        );
      }
      const orderItem = this.orderRepository.createOrderItem({
        product,
        quantity: item.quantity,
        unitPrice: product.price,
      });
      orderItems.push(orderItem);

      total += product.price * item.quantity;
    }
    if (user.balance < total) {
      throw new ValidationError(
        `Insufficient balance. Required: $${total}, Available: $${user.balance}`
      );
    }
    if (hasTrustedPayment) {
      await this.usersService.deductBalance(userId, total);
      Array.from(productMap.values()).forEach(product => {
        const item = items.find(i => i.productId === product.id);
        if (item) {
          product.stock -= item.quantity;
        }
      });
      await this.orderRepository.saveProducts(Array.from(productMap.values()));
      const order = await this.orderRepository.createOrder({
        user: { id: userId } as any,
        items: orderItems,
        total,
        status: 'completed',
      });
      const createdOrder = await this.orderRepository.findOrderById(order.id);
      return { order: createdOrder, requiresVerification: false };
    }
    const order = await this.orderRepository.createOrder({
      user: { id: userId } as any,
      items: orderItems,
      total,
      status: 'pending',
    });
    const verificationToken = jwt.sign(
      { orderId: order.id, userId: user.id, purpose: 'order-verification' },
      appConfig.jwtSecret as jwt.Secret,
      { expiresIn: `${appConfig.orderVerificationExpiryMinutes}m` }
    );
    const verificationLink = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify-order?token=${verificationToken}&remember=false`;
    const verificationLinkWithRemember = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/verify-order?token=${verificationToken}&remember=true`;
    const itemsRows = orderItems
      .map(
        (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td class="product-name">${item.product.name}</td>
          <td class="text-center">${item.quantity}</td>
          <td class="text-right">$${item.unitPrice.toFixed(2)}</td>
          <td class="text-right">$${(item.quantity * item.unitPrice).toFixed(2)}</td>
        </tr>
      `
      )
      .join('');
    const html = EmailTemplates.orderVerification(
      user.name,
      order.id,
      total.toFixed(2),
      itemsRows,
      verificationLink,
      verificationLinkWithRemember
    );

    await sendMail(
      user.email,
      `Verificar pago`,
      html,
      `Por favor verifica tu pago para la orden #${order.id}. Link: ${verificationLink}`
    );

    const createdOrder = await this.orderRepository.findOrderById(order.id);
    return { 
      order: createdOrder, 
      requiresVerification: true,
      message: 'Order created. Please check your email to verify payment within 5 minutes.' 
    };
  }
  async listAllOrders(filters?: {
    userId?: number;
    status?: 'pending' | 'completed' | 'cancelled';
    minTotal?: number;
    maxTotal?: number;
  }) {
    return await this.orderRepository.findAllOrdersWithFilters(filters);
  }
  async getOrderById(orderId: number) {
    const order = await this.orderRepository.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError('Order');
    }
    return order;
  }
  async getUserOrders(userId: number) {
    return await this.orderRepository.findOrdersByUserId(userId);
  }

  /**
   * Complete order payment verification - deduct balance and stock
   * This should only be called after token verification
   */
  async completeOrderPayment(orderId: number, userId: number) {
    // Get order with relations
    const order = await this.orderRepository.findOrderById(orderId);
    if (!order) {
      throw new NotFoundError('Order');
    }

    // Validate order belongs to user
    if (order.user.id !== userId) {
      throw new ValidationError('Order does not belong to user');
    }

    // Check if order is already completed or cancelled
    if (order.status === 'completed') {
      return {
        message: 'Order already verified',
        order,
        alreadyCompleted: true,
      };
    }

    if (order.status === 'cancelled') {
      throw new ValidationError('Order has been cancelled');
    }

    // Validate and deduct user balance
    try {
      await this.usersService.deductBalance(userId, order.total);
    } catch (error) {
      // Cancel the order if insufficient balance
      order.status = 'cancelled';
      await this.orderRepository.saveOrder(order);
      throw error;
    }

    // Deduct product stock
    const productIds = order.items.map(item => item.product.id);
    const products = await this.orderRepository.findProductsByIds(productIds);

    const productMap = new Map<number, Product>();
    products.forEach((product: Product | null, index: number) => {
      if (product) {
        const orderItem = order.items.find(item => item.product.id === productIds[index]);
        if (orderItem) {
          product.stock -= orderItem.quantity;
          productMap.set(product.id, product);
        }
      }
    });

    await this.orderRepository.saveProducts(Array.from(productMap.values()));

    // Mark order as completed
    order.status = 'completed';
    await this.orderRepository.saveOrder(order);

    // Get updated user data with current balance
    const updatedUser = await this.usersService.findById(userId);
    if (!updatedUser) {
      throw new NotFoundError('User');
    }

    // Send invoice email with PDF attachment
    try {
      // Generate PDF invoice
      const pdfBuffer = await PDFGenerator.generateInvoice(order);

      // Get email HTML template
      const html = EmailTemplates.orderCompleted(
        order.user.name,
        order.id,
        new Date(order.createdAt).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        order.total.toFixed(2),
        updatedUser.balance.toFixed(2)
      );

      // Send email with PDF attachment
      await sendMail(
        order.user.email,
        `¡Gracias por tu compra! - Orden #${order.id}`,
        html,
        `Gracias por tu compra. Tu orden #${order.id} ha sido completada exitosamente.`,
        [
          {
            filename: `Factura-${order.id}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ]
      );

      logger.info(`Invoice PDF sent to ${order.user.email} for order #${order.id}`);
    } catch (emailError) {
      // Log error but don't fail the order completion
      logger.error(`Failed to send invoice email for order #${order.id}:`, emailError);
    }

    return {
      message: 'Payment verified successfully',
      order,
      alreadyCompleted: false,
    };
  }

  /**
   * Cancel order if verification expired
   */
  async cancelOrder(orderId: number) {
    const order = await this.orderRepository.findOrderById(orderId);
    if (order && order.status === 'pending') {
      order.status = 'cancelled';
      await this.orderRepository.saveOrder(order);
    }
  }
  /**
   * Cancel order by user request
   * Validates that the order belongs to the user and is in pending status
   */
  async cancelOrderByUser(orderId: number, userId: number) {
    const order = await this.orderRepository.findOrderById(orderId); 
    if (!order) {
      throw new NotFoundError('Order');
    }
    if (order.user.id !== userId) {
      throw new NotFoundError('Order');
    }
    if (order.status !== 'pending') {
      throw new ValidationError(
        `No se puede cancelar esta orden. Estado actual: ${order.status === 'completed' ? 'completada' : 'cancelada'}`
      );
    }
    order.status = 'cancelled';
    await this.orderRepository.saveOrder(order);
    return {
      message: 'Orden cancelada exitosamente',
      order,
    };
  }

  async updateOrder(
    orderId: number,
    payload: {
      status?: 'pending' | 'completed' | 'cancelled';
      items?: Array<{ productId: number; quantity: number }>;
    }
  ) {
    const order = await this.getOrderById(orderId);
    // If updating items, we need to restore old stock and apply new stock changes
    if (payload.items) {
      // 1. Fetch all old products CONCURRENTLY to restore stock
      const oldProductIds = order.items.map(item => item.product.id);
      const oldProducts = await this.orderRepository.findProductsByIds(oldProductIds);
      // 2. Restore stock from old items
      const oldProductMap = new Map<number, Product>();
      oldProducts.forEach((product, index) => {
        if (product) {
          const oldItem = order.items.find(item => item.product.id === oldProductIds[index]);
          if (oldItem) {
            product.stock += oldItem.quantity;
            oldProductMap.set(product.id, product);
          }
        }
      });
      // 3. Save restored stock CONCURRENTLY
      await this.orderRepository.saveProducts(Array.from(oldProductMap.values()));
      // 4. Remove old items
      await this.orderRepository.removeOrderItems(order.items);
      // 5. Fetch all new products CONCURRENTLY
      const newProductIds = payload.items.map(item => item.productId);
      const newProducts = await this.orderRepository.findProductsByIds(newProductIds);
      // 6. Create a map for quick lookup
      const newProductMap = new Map<number, Product>();
      newProducts.forEach((product, index) => {
        if (product) {
          newProductMap.set(newProductIds[index], product);
        }
      });
      // 7. Validate all products exist and have sufficient stock
      const newOrderItems: OrderItem[] = [];
      let total = 0;
      for (const item of payload.items) {
        const product = newProductMap.get(item.productId);
        if (!product) {
          throw new NotFoundError(`Product with ID ${item.productId}`);
        }
        if (product.stock < item.quantity) {
          throw new ValidationError(
            `Insufficient stock for product "${product.name}". Available: ${product.stock}, requested: ${item.quantity}`
          );
        }
        // Decrease product stock
        product.stock -= item.quantity;
        // Create order item
        const orderItem = this.orderRepository.createOrderItem({
          order,
          product,
          quantity: item.quantity,
          unitPrice: product.price,
        });
        newOrderItems.push(orderItem);
        total += product.price * item.quantity;
      }

      // 8. Save all new product stock updates CONCURRENTLY
      await this.orderRepository.saveProducts(Array.from(newProductMap.values()));
      order.items = newOrderItems;
      order.total = total;
    }
    // Update status
    if (payload.status) {
      order.status = payload.status;
    }
    await this.orderRepository.saveOrder(order);
    // Reload with relations
    return await this.getOrderById(orderId);
  }
  async deleteOrder(orderId: number) {
    const order = await this.getOrderById(orderId);
    // 1. Fetch all products CONCURRENTLY to restore stock
    const productIds = order.items.map(item => item.product.id);
    const products = await this.orderRepository.findProductsByIds(productIds);

    // 2. Restore product stock
    const productMap = new Map<number, Product>();
    products.forEach((product, index) => {
      if (product) {
        const item = order.items.find(item => item.product.id === productIds[index]);
        if (item) {
          product.stock += item.quantity;
          productMap.set(product.id, product);
        }
      }
    });

    // 3. Save all restored stock CONCURRENTLY
    await this.orderRepository.saveProducts(Array.from(productMap.values()));

    await this.orderRepository.removeOrder(order);

    return { ok: true, message: 'Order deleted successfully and stock restored' };
  }
}
