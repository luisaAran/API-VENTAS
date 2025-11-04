import PDFDocument from 'pdfkit';
import { Order } from '../../domain/orders/models/Order';
import fs from 'fs';

/**
 * PDF Generator using PDFKit
 * Generates professional invoice PDFs programmatically (no browser required)
 */
export class PDFGenerator {
  /**
   * Generate a PDF invoice from an order
   * @param order - The order to generate an invoice for
   * @returns PDF as a Buffer
   */
  static async generateInvoice(order: Order): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Create a new PDF document
        const doc = new PDFDocument({
          size: 'A4',
          margin: 50,
          info: {
            Title: `Factura #${order.id}`,
            Author: 'API Ventas Backend',
            Subject: `Factura de compra #${order.id}`,
          },
        });

        // Buffer to store PDF data
        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Colors
        const primaryColor = '#2C3E50';
        const accentColor = '#27AE60';
        const lightGray = '#ECF0F1';
        const textGray = '#7F8C8D';

        // Header - Company Name
        doc
          .fontSize(28)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('API Ventas', 50, 50);

        doc
          .fontSize(10)
          .fillColor(textGray)
          .font('Helvetica')
          .text('Universidad Autónoma de Manizales', 50, 85)
          .text('luisam.arangol@autonoma.edu.co | +57 300 123 4567', 50, 100);

        // Invoice Title and Status
        doc
          .fontSize(24)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text(`FACTURA #${order.id}`, 350, 50, { align: 'right' });

        // Status Badge
        const statusText = order.status === 'completed' ? 'PAGADO' : 'PENDIENTE';
        const statusColor = order.status === 'completed' ? accentColor : '#E74C3C';
        doc
          .fontSize(12)
          .fillColor(statusColor)
          .font('Helvetica-Bold')
          .text(statusText, 350, 85, { align: 'right' });

        // Date
        const orderDate = new Date(order.createdAt).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        doc
          .fontSize(10)
          .fillColor(textGray)
          .font('Helvetica')
          .text(`Fecha: ${orderDate}`, 350, 105, { align: 'right' });

        // Separator line
        doc
          .strokeColor(lightGray)
          .lineWidth(2)
          .moveTo(50, 140)
          .lineTo(545, 140)
          .stroke();

        // Customer Information Section
        doc
          .fontSize(12)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('INFORMACIÓN DEL CLIENTE', 50, 160);

        doc
          .fontSize(10)
          .fillColor(textGray)
          .font('Helvetica')
          .text(`Nombre: ${order.user.name}`, 50, 185)
          .text(`ID Cliente: #${order.user.id}`, 50, 200)
          .text(`Email: ${order.user.email}`, 50, 215)

        // Items Table Header
        const tableTop = 280;
        doc
          .fontSize(12)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('DETALLES DE LA COMPRA', 50, 260);

        // Table header background
        doc.rect(50, tableTop, 495, 25).fill(lightGray);

        // Table headers
        doc
          .fontSize(10)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('#', 60, tableTop + 8)
          .text('Producto', 90, tableTop + 8)
          .text('Cantidad', 300, tableTop + 8)
          .text('Precio Unit.', 380, tableTop + 8)
          .text('Total', 480, tableTop + 8);

        // Table rows
        let yPosition = tableTop + 35;
        order.items.forEach((item, index) => {
          const itemTotal = item.unitPrice * item.quantity;

          doc
            .fontSize(10)
            .fillColor(textGray)
            .font('Helvetica')
            .text(`${index + 1}`, 60, yPosition)
            .text(item.product.name, 90, yPosition, { width: 200 })
            .text(`${item.quantity}`, 300, yPosition)
            .text(`$${item.unitPrice.toFixed(2)}`, 380, yPosition)
            .text(`$${itemTotal.toFixed(2)}`, 480, yPosition);

          // Row separator
          yPosition += 30;
          doc
            .strokeColor(lightGray)
            .lineWidth(0.5)
            .moveTo(50, yPosition - 5)
            .lineTo(545, yPosition - 5)
            .stroke();
        });

        // Totals Section
        yPosition += 20;
        const totalsX = 380;

        doc
          .fontSize(10)
          .fillColor(textGray)
          .font('Helvetica')
          .text('Subtotal:', totalsX, yPosition)
          .text(`$${order.total.toFixed(2)}`, 480, yPosition);

        yPosition += 20;
        doc
          .fontSize(12)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('TOTAL:', totalsX, yPosition)
          .text(`$${order.total.toFixed(2)}`, 480, yPosition);

        // Footer - Thank you message
        doc
          .fontSize(10)
          .fillColor(accentColor)
          .font('Helvetica-Bold')
          .text('¡Gracias por tu compra!', 50, 700, {
            align: 'center',
            width: 495,
          });

        doc
          .fontSize(8)
          .fillColor(textGray)
          .font('Helvetica')
          .text(
            'Este documento es una factura electrónica generada automáticamente.',
            50,
            720,
            {
              align: 'center',
              width: 495,
            }
          );

        doc
          .fontSize(8)
          .fillColor(textGray)
          .text(`© ${new Date().getFullYear()} API Ventas. Todos los derechos reservados.`, 50, 735, {
            align: 'center',
            width: 495,
          });

        // Finalize PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Save invoice PDF to file system
   * @param order - The order to generate an invoice for
   * @param outputPath - Path where to save the PDF file
   */
  static async saveInvoiceToFile(order: Order, outputPath: string): Promise<void> {
    const pdfBuffer = await this.generateInvoice(order);
    fs.writeFileSync(outputPath, pdfBuffer);
  }
}
