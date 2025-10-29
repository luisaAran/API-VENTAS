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

export async function sendMail(to: string, subject: string, html: string, text?: string) {
  const info = await transporter.sendMail({
    from: appConfig.smtp.from,
    to,
    subject,
    text: text || undefined,
    html,
  });
  return info;
}

export default { sendMail };
