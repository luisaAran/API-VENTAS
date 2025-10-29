import { Request, Response } from 'express';
import { ProductsService } from '../services/products.service';

export class ProductsController {
  constructor(private productsService: ProductsService) {}

  async createProduct(req: Request, res: Response) {
    const { name, description, price, stock } = req.body as { name: string; description?: string; price: number; stock: number };
    const created = await this.productsService.createProduct({ name, description, price, stock });
    return res.status(201).json(created);
  }

  async listProducts(req: Request, res: Response) {
    const products = await this.productsService.listProducts();
    return res.json(products);
  }
}
