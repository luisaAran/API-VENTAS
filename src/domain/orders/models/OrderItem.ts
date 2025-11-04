import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Order } from './Order';
import { Product } from '../../products/models/Product';

@Entity()
export class OrderItem {
  @PrimaryGeneratedColumn()
  id!: number;
  @ManyToOne(() => Order, (order) => order.items)
  order!: Order;
  @ManyToOne(() => Product)
  product!: Product;
  @Column({ type: 'int' })
  quantity!: number;
  @Column({ 
    type: 'decimal', 
    precision: 12, 
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  unitPrice!: number;
}
