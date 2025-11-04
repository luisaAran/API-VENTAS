import { Cart, CartItem, CartSummary } from '../models/Cart';
import { CartRepository } from '../repositories/cart.repository';
import { ProductsService } from '../../products/services/products.service';
import { OrdersService } from '../../orders/services/orders.service';
import { NotFoundError, ValidationError } from '../../../shared/errors';

export class CartService {
  constructor(
    private cartRepository: CartRepository,
    private productsService: ProductsService,
    private ordersService: OrdersService
  ) {}
  /**
   * Get user's cart
   */
  async getCart(userId: number): Promise<Cart> {
    const cart = await this.cartRepository.getCart(userId);
    if (!cart) {
      return {
        userId,
        items: [],
        updatedAt: new Date(),
      };
    }
    return cart;
  }
  /**
   * Get cart with product details and totals
   */
  async getCartSummary(userId: number): Promise<CartSummary> {
    const cart = await this.getCart(userId);
    if (cart.items.length === 0) {
      return {
        userId,
        items: [],
        total: 0,
        itemCount: 0,
        updatedAt: cart.updatedAt,
      };
    }
    // Fetch all products
    const productIds = cart.items.map(item => item.productId);
    const products = await Promise.all(
      productIds.map(id => this.productsService.getProductById(id))
    );
    // Build summary with product details
    const items = cart.items.map((item, index) => {
      const product = products[index];
      if (!product) {
        throw new NotFoundError(`Product with ID ${item.productId}`);
      }
      return {
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        quantity: item.quantity,
        subtotal: product.price * item.quantity,
      };
    });
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    return {
      userId,
      items,
      total,
      itemCount,
      updatedAt: cart.updatedAt,
    };
  }
  /**
   * Add item to cart or update quantity if already exists
   */
  async addItem(userId: number, productId: number, quantity: number): Promise<Cart> {
    // Validate product exists and has stock
    const product = await this.productsService.getProductById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${productId}`);
    }
    if (quantity <= 0) {
      throw new ValidationError('Quantity must be greater than 0');
    }
    if (product.stock < quantity) {
      throw new ValidationError(
        `Insufficient stock for product "${product.name}". Available: ${product.stock}, requested: ${quantity}`
      );
    }
    // Get or create cart
    let cart = await this.cartRepository.getCart(userId);
    if (!cart) {
      cart = {
        userId,
        items: [],
        updatedAt: new Date(),
      };
    }

    // Check if item already exists
    const existingItemIndex = cart.items.findIndex(item => item.productId === productId);

    if (existingItemIndex >= 0) {
      // Update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;

      // Validate total quantity doesn't exceed stock
      if (product.stock < newQuantity) {
        throw new ValidationError(
          `Insufficient stock. You have ${cart.items[existingItemIndex].quantity} in cart. Available: ${product.stock}`
        );
      }

      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item
      cart.items.push({
        productId,
        quantity,
        addedAt: new Date(),
      });
    }

    cart.updatedAt = new Date();
    await this.cartRepository.saveCart(cart);

    return cart;
  }

  /**
   * Update item quantity in cart
   */
  async updateItemQuantity(userId: number, productId: number, quantity: number): Promise<Cart> {
    if (quantity <= 0) {
      throw new ValidationError('Quantity must be greater than 0');
    }
    const cart = await this.cartRepository.getCart(userId);
    if (!cart) {
      throw new NotFoundError('Cart');
    }
    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    if (itemIndex === -1) {
      throw new NotFoundError(`Product ${productId} not found in cart`);
    }
    const product = await this.productsService.getProductById(productId);
    if (!product) {
      throw new NotFoundError(`Product with ID ${productId}`);
    }

    if (product.stock < quantity) {
      throw new ValidationError(
        `Insufficient stock for product "${product.name}". Available: ${product.stock}, requested: ${quantity}`
      );
    }
    cart.items[itemIndex].quantity = quantity;
    cart.updatedAt = new Date();
    await this.cartRepository.saveCart(cart);
    return cart;
  }
  /**
   * Remove item from cart
   */
  async removeItem(userId: number, productId: number): Promise<Cart> {
    const cart = await this.cartRepository.getCart(userId);
    if (!cart) {
      throw new NotFoundError('Cart');
    }
    const itemIndex = cart.items.findIndex(item => item.productId === productId);
    if (itemIndex === -1) {
      throw new NotFoundError(`Product ${productId} not found in cart`);
    }
    cart.items.splice(itemIndex, 1);
    cart.updatedAt = new Date();
    if (cart.items.length === 0) {
      await this.cartRepository.deleteCart(userId);
      return {
        userId,
        items: [],
        updatedAt: new Date(),
      };
    }
    await this.cartRepository.saveCart(cart);
    return cart;
  }

  /**
   * Clear entire cart
   */
  async clearCart(userId: number): Promise<void> {
    await this.cartRepository.deleteCart(userId);
  }

  /**
   * Checkout: create order from cart
   */
  async checkout(userId: number, trustedPayment: boolean = false): Promise<any> {
    const cart = await this.cartRepository.getCart(userId);
    if (!cart || cart.items.length === 0) {
      throw new ValidationError('Cart is empty');
    }
    const orderItems = cart.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
    const result = await this.ordersService.createOrder(userId, orderItems, trustedPayment);
    await this.cartRepository.deleteCart(userId);
    return result;
  }
}
