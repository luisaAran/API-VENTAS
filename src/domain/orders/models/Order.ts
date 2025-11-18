import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, Timestamp } from 'typeorm';
import { User } from '../../users/models/User';
import { OrderItem } from './OrderItem';

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id!: number;
  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  cancelledAt!: Date | null;

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
  // Change to SET NULL to preserve order history when user is soft deleted
  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'SET NULL', nullable: true })
  user!: User | null;
  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items!: OrderItem[];
}
