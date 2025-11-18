import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Ventas E-commerce API',
      version,
      description: `
E-commerce API con autenticación JWT, gestión de usuarios, productos, órdenes y carrito de compras.

## Características principales:
- 🔐 Autenticación con JWT (2FA opcional)
- 👥 Gestión de usuarios con roles (user/admin)
- 📦 CRUD completo de productos
- 🛒 Carrito de compras con Redis
- 📋 Sistema de órdenes con verificación de pago
- 🗑️ Soft delete para usuarios
- 📧 Notificaciones por email
- 🔄 Cola de jobs con Bull

## Autenticación:
La mayoría de los endpoints requieren autenticación mediante cookies HTTP-only que contienen tokens JWT.
Los tokens se obtienen al hacer login exitoso (\`POST /api/auth/login\` y \`POST /api/auth/verify-code\`).

## Roles:
- **user**: Usuario regular, puede comprar productos y gestionar su perfil
- **admin**: Administrador, puede gestionar usuarios y productos
      `,
      contact: {
        name: 'API Support',
        email: 'support@ventas.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: process.env.APP_URL || 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Autenticación y gestión de sesiones',
      },
      {
        name: 'Users',
        description: 'Gestión de usuarios',
      },
      {
        name: 'Products',
        description: 'Gestión de productos del catálogo',
      },
      {
        name: 'Orders',
        description: 'Gestión de órdenes de compra',
      },
      {
        name: 'Cart',
        description: 'Carrito de compras',
      },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'accessToken',
          description: 'JWT token almacenado en cookie HTTP-only',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Juan Pérez' },
            email: { type: 'string', format: 'email', example: 'juan@example.com' },
            balance: { type: 'number', format: 'double', example: 1000.50 },
            role: { type: 'string', enum: ['user', 'admin'], example: 'user' },
            emailVerified: { type: 'boolean', example: true },
            notifyBalanceUpdates: { type: 'boolean', example: true },
          },
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Laptop HP Pavilion 15' },
            description: { type: 'string', example: 'Laptop HP 15.6 pulgadas, 8GB RAM, 256GB SSD' },
            price: { type: 'number', format: 'double', example: 899.99 },
            stock: { type: 'integer', example: 50 },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            createdAt: { type: 'string', format: 'date-time', example: '2025-11-18T10:30:00.000Z' },
            total: { type: 'number', format: 'double', example: 1299.97 },
            status: { type: 'string', enum: ['pending', 'completed', 'cancelled'], example: 'completed' },
            user: { $ref: '#/components/schemas/User' },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/OrderItem' },
            },
          },
        },
        OrderItem: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            quantity: { type: 'integer', example: 2 },
            unitPrice: { type: 'number', format: 'double', example: 599.99 },
            product: { $ref: '#/components/schemas/Product' },
          },
        },
        CartItem: {
          type: 'object',
          properties: {
            productId: { type: 'integer', example: 1 },
            quantity: { type: 'integer', example: 2 },
            addedAt: { type: 'string', format: 'date-time', example: '2025-11-18T10:30:00.000Z' },
          },
        },
        Cart: {
          type: 'object',
          properties: {
            userId: { type: 'integer', example: 1 },
            items: {
              type: 'array',
              items: { $ref: '#/components/schemas/CartItem' },
            },
            updatedAt: { type: 'string', format: 'date-time', example: '2025-11-18T10:30:00.000Z' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'VALIDATION_ERROR',
                'AUTHENTICATION_ERROR',
                'AUTHORIZATION_ERROR',
                'NOT_FOUND',
                'CONFLICT',
                'INTERNAL_ERROR',
              ],
              example: 'VALIDATION_ERROR',
            },
            message: { type: 'string', example: 'Validation failed' },
            timestamp: { type: 'string', format: 'date-time', example: '2025-11-18T10:30:00.000Z' },
            details: { type: 'object', additionalProperties: true },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'No autenticado - Token faltante, inválido o expirado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                type: 'AUTHENTICATION_ERROR',
                message: 'Invalid or expired token',
                timestamp: '2025-11-18T10:30:00.000Z',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'No autorizado - Permisos insuficientes',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                type: 'AUTHORIZATION_ERROR',
                message: 'Insufficient permissions',
                timestamp: '2025-11-18T10:30:00.000Z',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Recurso no encontrado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                type: 'NOT_FOUND',
                message: 'User not found',
                timestamp: '2025-11-18T10:30:00.000Z',
              },
            },
          },
        },
        ValidationError: {
          description: 'Error de validación',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                type: 'VALIDATION_ERROR',
                message: 'Validation failed',
                timestamp: '2025-11-18T10:30:00.000Z',
                details: {
                  'body.email': 'Invalid email format',
                  'body.password': 'Password must be at least 8 characters',
                },
              },
            },
          },
        },
        ConflictError: {
          description: 'Conflicto - Recurso ya existe',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                type: 'CONFLICT',
                message: 'Email already used',
                timestamp: '2025-11-18T10:30:00.000Z',
              },
            },
          },
        },
        InternalError: {
          description: 'Error interno del servidor',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                type: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
                timestamp: '2025-11-18T10:30:00.000Z',
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/domain/*/routes/*.ts', './dist/domain/*/routes/*.js'], // Paths to files containing OpenAPI definitions
};

export const swaggerSpec = swaggerJsdoc(options);
