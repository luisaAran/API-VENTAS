import PDFDocument from 'pdfkit';
import { Order } from '../../domain/orders/models/Order';
import fs from 'fs';
import path from 'path';
import logger from './logger';

/**
 * PDF Generator using PDFKit
 * Generates professional invoice PDFs programmatically (no browser required)
 */
export class PDFGenerator {
  private static readonly LOGO_PATH = path.join(__dirname, '../../assets/logo.png');
  /**
   * Check if logo file exists
   */
  private static hasLogo(): boolean {
    try {
      return fs.existsSync(this.LOGO_PATH);
    } catch (error) {
      return false;
    }
  }
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

        // Header Layout: Logo on left, company info below logo, invoice info on right
        const headerStartY = 45;
        let logoHeight = 0;
        
        if (PDFGenerator.hasLogo()) {
          try {
            // Add logo (543x301 original → scaled to 150x83 for prominence)
            const logoWidth = 150;
            logoHeight = 83;
            
            doc.image(PDFGenerator.LOGO_PATH, 50, headerStartY, {
              width: logoWidth,
              height: logoHeight,
            });
            
            logger.info('✅ Logo added to PDF invoice (150x83)');
          } catch (error) {
            logger.warn('⚠️  Failed to add logo to PDF, using text fallback:', error);
          }
        }
        
        // Company info below logo - left aligned
        const companyInfoY = headerStartY + logoHeight + 10;
        
        // Company Name - left aligned, smaller
        doc
          .fontSize(16) // Reduced from 20
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('API Ventas', 50, companyInfoY);

        // Company details - left aligned
        doc
          .fontSize(9)
          .fillColor(textGray)
          .font('Helvetica')
          .text('Universidad Autónoma de Manizales', 50, companyInfoY + 22)
          .text('luisam.arangol@autonoma.edu.co', 50, companyInfoY + 36)
          .text('+57 300 123 4567', 50, companyInfoY + 50);

        // Invoice Title and Info - right side, same level as logo
        // Invoice Title (right side)
        doc
          .fontSize(22)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text(`FACTURA #${order.id}`, 350, headerStartY, { align: 'right' });

        // Status Badge (right side)
        const statusText = order.status === 'completed' ? 'PAGADO' : 'PENDIENTE';
        const statusColor = order.status === 'completed' ? accentColor : '#E74C3C';
        doc
          .fontSize(11)
          .fillColor(statusColor)
          .font('Helvetica-Bold')
          .text(statusText, 350, headerStartY + 30, { align: 'right' });

        // Date (right side)
        const orderDate = new Date(order.createdAt).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
        doc
          .fontSize(9)
          .fillColor(textGray)
          .font('Helvetica')
          .text(`Fecha: ${orderDate}`, 350, headerStartY + 48, { align: 'right' });

        // Separator line - below all header content
        const separatorY = companyInfoY + 70; // After company details
        doc
          .strokeColor(lightGray)
          .lineWidth(2)
          .moveTo(50, separatorY)
          .lineTo(545, separatorY)
          .stroke();

        // Customer Information Section
        const customerInfoY = separatorY + 20;
        doc
          .fontSize(12)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('INFORMACIÓN DEL CLIENTE', 50, customerInfoY);

        doc
          .fontSize(10)
          .fillColor(textGray)
          .font('Helvetica')
          .text(`Nombre: ${order.user.name}`, 50, customerInfoY + 25)
          .text(`ID Cliente: #${order.user.id}`, 50, customerInfoY + 40)
          .text(`Email: ${order.user.email}`, 50, customerInfoY + 55);

        // Items Table Section
        const tableTop = customerInfoY + 95;
        doc
          .fontSize(12)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('DETALLES DE LA COMPRA', 50, tableTop - 20);
        doc.rect(50, tableTop, 495, 25).fill(lightGray);
        doc
          .fontSize(10)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('#', 60, tableTop + 8)
          .text('Producto', 90, tableTop + 8)
          .text('Cantidad', 300, tableTop + 8)
          .text('Precio Unit.', 380, tableTop + 8)
          .text('Total', 480, tableTop + 8);
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
          yPosition += 30;
          doc
            .strokeColor(lightGray)
            .lineWidth(0.5)
            .moveTo(50, yPosition - 5)
            .lineTo(545, yPosition - 5)
            .stroke();
        });
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
