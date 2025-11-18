import { AppDataSource } from '../../../data-source';
import { Product } from '../models/Product';
import { NotFoundError } from '../../../shared/errors';
import { Like } from 'typeorm';

export class ProductsService {
  async createProduct(payload: { name: string; description?: string; price: number; stock: number }) {
    const { name, description, price, stock } = payload;
    const repo = AppDataSource.getRepository(Product);
    const product = repo.create({ name, description, price, stock });
    await repo.save(product);
    return product;
  }

  async listProducts(filters?: { 
    name?: string;
    search?: string;
    minPrice?: number; 
    maxPrice?: number; 
    inStock?: boolean;
    page?: number;
    limit?: number;
  }) {
    const repo = AppDataSource.getRepository(Product);
    const queryBuilder = repo.createQueryBuilder('product');
    
    // Apply filters if provided
    if (filters?.name) {
      queryBuilder.andWhere('LOWER(product.name) LIKE LOWER(:name)', { name: `%${filters.name}%` });
    }
    
    // Search filter (searches in name AND description)
    if (filters?.search) {
      queryBuilder.andWhere(
        '(LOWER(product.name) LIKE LOWER(:search) OR LOWER(product.description) LIKE LOWER(:search))',
        { search: `%${filters.search}%` }
      );
    }
    
    if (filters?.minPrice !== undefined) {
      queryBuilder.andWhere('product.price >= :minPrice', { minPrice: filters.minPrice });
    }
    if (filters?.maxPrice !== undefined) {
      queryBuilder.andWhere('product.price <= :maxPrice', { maxPrice: filters.maxPrice });
    }
    if (filters?.inStock !== undefined) {
      if (filters.inStock) {
        queryBuilder.andWhere('product.stock > 0');
      } else {
        queryBuilder.andWhere('product.stock = 0');
      }
    }

    // Pagination
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();
    
    return {
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get product suggestions within user's budget
   * Returns up to 3 products that the user can afford, with available stock
   * @param maxPrice - Maximum price the user can afford (their balance)
   * @returns Array of up to 3 suggested products
   */
  async getSuggestedProducts(maxPrice: number): Promise<Product[]> {
    const repo = AppDataSource.getRepository(Product);
    const products = await repo
      .createQueryBuilder('product')
      .where('product.price <= :maxPrice', { maxPrice })
      .andWhere('product.stock > 0')
      .orderBy('RAND()') // Random selection for variety
      .limit(3)
      .getMany();
    
    return products;
  }
  async getProductById(id: number) {
    const repo = AppDataSource.getRepository(Product);
    const product = await repo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundError('Product');
    } 
    return product;
  }
  async updateProduct(id: number, payload: { name?: string; description?: string; price?: number; stock?: number }) {
    const repo = AppDataSource.getRepository(Product);
    const product = await this.getProductById(id);
    // Update only provided fields
    if (payload.name !== undefined) product.name = payload.name;
    if (payload.description !== undefined) product.description = payload.description;
    if (payload.price !== undefined) product.price = payload.price;
    if (payload.stock !== undefined) product.stock = payload.stock;
    await repo.save(product);
    return product;
  }
  async deleteProduct(id: number) {
    const repo = AppDataSource.getRepository(Product);
    const product = await this.getProductById(id);
    await repo.remove(product);
    return { ok: true, message: 'Product deleted successfully' };
  }
}
