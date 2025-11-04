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
    // Extract query params for filtering
    const { name, minPrice, maxPrice } = req.query as { name?: string; minPrice?: string; maxPrice?: string };
    
    const filters = {
      name,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    };
    
    const products = await this.productsService.listProducts(filters);
    return res.json(products);
  }

  async getProductById(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const product = await this.productsService.getProductById(parseInt(id, 10));
    return res.json(product);
  }

  async updateProduct(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const { name, description, price, stock } = req.body as { name?: string; description?: string; price?: number; stock?: number };
    const updated = await this.productsService.updateProduct(parseInt(id, 10), { name, description, price, stock });
    return res.json(updated);
  }

  async deleteProduct(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const result = await this.productsService.deleteProduct(parseInt(id, 10));
    return res.json(result);
  }
}
