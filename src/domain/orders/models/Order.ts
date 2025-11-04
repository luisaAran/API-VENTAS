import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn } from 'typeorm';
import { User } from '../../users/models/User';
import { OrderItem } from './OrderItem';

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;
  @CreateDateColumn()
  createdAt!: Date;
  @Column({ 
    type: 'decimal', 
    precision: 12, 
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value)
    }
  })
  total!: number;
  @Column({ type: 'enum', enum: ['pending', 'completed', 'cancelled'], default: 'pending' })
  status!: 'pending' | 'completed' | 'cancelled';
  @ManyToOne(() => User, (user) => user.orders)
  user!: User;
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items!: OrderItem[];
}
