import { Request, Response } from 'express';
import { UsersService } from '../services/users.service';

export class UsersController {
  constructor(private usersService: UsersService) {}

  async createUser(req: Request, res: Response) {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    const created = await this.usersService.createUser({ name, email, password });
    return res.status(201).json(created);
  }

  async listUsers(req: Request, res: Response) {
    const users = await this.usersService.listUsers();
    return res.json(users);
  }
}
