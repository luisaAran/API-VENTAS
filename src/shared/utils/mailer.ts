import nodemailer from 'nodemailer';
import { config as appConfig } from '../config';

const transporter = nodemailer.createTransport({
  host: appConfig.smtp.host,
  port: appConfig.smtp.port,
  secure: appConfig.smtp.secure,
  auth: appConfig.smtp.authUser
    ? { user: appConfig.smtp.authUser, pass: appConfig.smtp.authPass }
    : undefined,
});

interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export async function sendMail(
  to: string,
  subject: string,
  html: string,
  text?: string,
  attachments?: MailAttachment[]
) {
  const info = await transporter.sendMail({
    from: appConfig.smtp.from,
    to,
    subject,
    text: text || undefined,
    html,
    attachments: attachments || undefined,
  });
  return info;
}

export default { sendMail };
