import fs from 'fs';
import path from 'path';

/**
 * Template variables that can be replaced in email templates
 */
interface TemplateVariables {
  [key: string]: string | number;
}

/**
 * Product suggestion for email templates
 */
export interface ProductSuggestion {
  id: number;
  name: string;
  price: number;
  stock: number;
}

/**
 * Available email template names
 */
export type EmailTemplate = 'email-verification' | 'login-code' | 'order-verification' | 'balance-added' | 'order-completed' | 'product-out-of-stock';

/**
 * Load an email template from the templates directory
 * @param templateName - Name of the template file (without .html extension)
 * @returns The HTML content of the template
 */
function loadTemplate(templateName: EmailTemplate): string {
  const templatePath = path.join(__dirname, 'email', `${templateName}.html`);
  
  try {
    return fs.readFileSync(templatePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to load email template: ${templateName}. Error: ${error}`);
  }
}

/**
 * Replace template variables with actual values
 * Variables in templates are marked as {{variableName}}
 * @param template - HTML template string
 * @param variables - Object with variable names and values
 * @returns Rendered HTML with replaced variables
 */
function renderTemplate(template: string, variables: TemplateVariables): string {
  let rendered = template;
  
  // Replace all {{variableName}} with actual values
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(regex, String(variables[key]));
  });
  
  // Add current year if not provided
  if (!variables.year) {
    const year = new Date().getFullYear();
    rendered = rendered.replace(/{{year}}/g, String(year));
  }
  
  return rendered;
}

/**
 * Load and render an email template with the provided variables
 * @param templateName - Name of the template to use
 * @param variables - Variables to replace in the template
 * @returns Rendered HTML ready to send
 */
export function getEmailTemplate(
  templateName: EmailTemplate,
  variables: TemplateVariables
): string {
  const template = loadTemplate(templateName);
  return renderTemplate(template, variables);
}

/**
 * Helper functions for specific email types
 */
export const EmailTemplates = {
  /**
   * Email verification template
   */
  emailVerification: (name: string, verificationLink: string) => {
    return getEmailTemplate('email-verification', {
      name,
      verificationLink,
    });
  },

  /**
   * 2FA login code template
   */
  loginCode: (name: string, code: string) => {
    return getEmailTemplate('login-code', {
      name,
      code,
    });
  },

  /**
   * Order payment verification template
   */
  orderVerification: (
    name: string,
    orderId: number,
    total: string,
    itemsRows: string,
    verificationLink: string,
    verificationLinkWithRemember: string
  ) => {
    return getEmailTemplate('order-verification', {
      name,
      orderId,
      total,
      itemsRows,
      verificationLink,
      verificationLinkWithRemember,
    });
  },

  /**
   * Balance added confirmation template
   */
  balanceAdded: (
    name: string,
    amountAdded: string,
    newBalance: string,
    unsubscribeLink: string,
    suggestedProducts?: ProductSuggestion[]
  ) => {
    // Build products section HTML if products are provided
    let productsSection = '';
    
    if (suggestedProducts && suggestedProducts.length > 0) {
      const productCards = suggestedProducts
        .map(
          (product) => `
        <div class="product-card">
          <div class="product-name">${product.name}</div>
          <div class="product-details">
            ID: #${product.id}
            <span class="stock-badge">${product.stock} in stock</span>
          </div>
          <div class="product-price">$${product.price.toFixed(2)}</div>
        </div>
      `
        )
        .join('');

      productsSection = `
        <div class="products-section">
          <div class="products-title">🛍️ You Might Be Interested In</div>
          ${productCards}
        </div>
      `;
    }

    return getEmailTemplate('balance-added', {
      name,
      amountAdded,
      newBalance,
      productsSection,
      unsubscribeLink,
    });
  },

  /**
   * Order completed confirmation template (with invoice attachment)
   */
  orderCompleted: (
    name: string,
    orderId: number,
    date: string,
    total: string,
    currentBalance: string
  ) => {
    return getEmailTemplate('order-completed', {
      name,
      orderId,
      date,
      total,
      currentBalance,
    });
  },

  /**
   * Product out of stock notification template
   */
  productOutOfStock: (
    userName: string,
    products: Array<{ productName: string; quantity: number }>,
    productsUrl: string
  ) => {
    // Build products table rows with dark theme
    const productsTableRows = products
      .map(
        (p) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #3F4B59; color: #FFFFFF;">${p.productName}</td>
          <td style="padding: 12px; border-bottom: 1px solid #3F4B59; text-align: center; color: #FFFFFF;">${p.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #3F4B59; text-align: center;">
            <span style="background-color: #3F4B59; color: #FFD700; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; border: 1px solid #FFD700;">
              ❌ Agotado
            </span>
          </td>
        </tr>`
      )
      .join('');
    
    const productsTable = `
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background-color: #1B2631;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ff9900; color: #FFFFFF;">Producto</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ff9900; color: #FFFFFF;">Cantidad</th>
            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ff9900; color: #FFFFFF;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${productsTableRows}
        </tbody>
      </table>`;
    
    // Determine subject and message based on product count
    const subject = products.length === 1 ? 'Producto agotado' : 'Productos agotados';
    const message = products.length === 1 
      ? 'El siguiente producto que tenías en tu carrito se ha agotado y ha sido eliminado automáticamente:'
      : 'Los siguientes productos que tenías en tu carrito se han agotado y han sido eliminados automáticamente:';
    
    return getEmailTemplate('product-out-of-stock', {
      userName,
      subject,
      message,
      productsTable,
      productsUrl,
    });
  },
};
