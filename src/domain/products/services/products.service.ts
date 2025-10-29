import { AppDataSource } from '../../../data-source';
import { Product } from '../models/Product';

export class ProductsService {
  async createProduct(payload: { name: string; description?: string; price: number; stock: number }) {
    const { name, description, price, stock } = payload;
    const repo = AppDataSource.getRepository(Product);
    const product = repo.create({ name, description, price, stock });
    await repo.save(product);
    return product;
  }

  async listProducts() {
    const repo = AppDataSource.getRepository(Product);
    const products = await repo.find();
    return products;
  }
}
