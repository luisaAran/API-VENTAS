import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { sendMail } from '../utils/mailer';
import logger from '../utils/logger';

// Email job data interface
export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string; // Can be Buffer or base64 string after serialization
    contentType: string;
  }>;
}

// Create email queue
export const emailQueue = new Queue<EmailJobData>('email-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds, then 4s, 8s
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 3600, // Remove after 1 hour
    },
    removeOnFail: {
      count: 500, // Keep last 500 failed jobs
      age: 86400, // Remove after 24 hours
    },
  },
});

// Add email to queue
export const queueEmail = async (emailData: EmailJobData): Promise<Job<EmailJobData>> => {
  try {
    // Convert Buffer attachments to base64 strings for Redis serialization
    const serializedData = {
      ...emailData,
      attachments: emailData.attachments?.map(att => ({
        ...att,
        content: Buffer.isBuffer(att.content) 
          ? att.content.toString('base64') 
          : att.content
      }))
    };
    
    const job = await emailQueue.add('send-email', serializedData, {
      priority: emailData.subject.includes('Verificar') ? 1 : 2, // Higher priority for verification emails
    });
    
    logger.info(`📧 Email queued: ${emailData.subject} to ${emailData.to} (Job ID: ${job.id})`);
    return job;
  } catch (error) {
    logger.error('❌ Failed to queue email:', error);
    throw error;
  }
};

// Email worker
let emailWorker: Worker<EmailJobData> | null = null;

export const initEmailWorker = () => {
  if (emailWorker) {
    logger.warn('⚠️  Email worker already initialized');
    return;
  }

  emailWorker = new Worker<EmailJobData>(
    'email-queue',
    async (job: Job<EmailJobData>) => {
      const { to, subject, html, text, attachments } = job.data;

      try {
        logger.info(`📤 Sending email: ${subject} to ${to} (Job ID: ${job.id})`);
        
        // Convert attachments back to Buffer if they were serialized as base64
        const processedAttachments = attachments?.map(att => ({
          ...att,
          content: typeof att.content === 'string' 
            ? Buffer.from(att.content, 'base64') 
            : att.content
        }));
        
        await sendMail(to, subject, html, text, processedAttachments);
        
        logger.info(`✅ Email sent successfully: ${subject} to ${to} (Job ID: ${job.id})`);
        
        return { success: true, to, subject };
      } catch (error) {
        logger.error(`❌ Failed to send email to ${to}:`, error);
        throw error; // BullMQ will retry based on job options
      }
    },
    {
      connection: redisConnection,
      concurrency: 5, // Process 5 emails concurrently
      limiter: {
        max: 10, // Max 10 emails
        duration: 1000, // Per second (rate limiting)
      },
    }
  );

  // Worker event handlers
  emailWorker.on('completed', (job: Job<EmailJobData>) => {
    logger.info(`✅ Email job completed: ${job.id} - ${job.data.subject}`);
  });

  emailWorker.on('failed', (job: Job<EmailJobData> | undefined, error: Error) => {
    if (job) {
      logger.error(`❌ Email job failed: ${job.id} - ${job.data.subject}`, error);
    } else {
      logger.error('❌ Email job failed with no job data', error);
    }
  });

  emailWorker.on('error', (error: Error) => {
    logger.error('❌ Email worker error:', error);
  });

  logger.info('✅ Email worker initialized with concurrency: 5, rate limit: 10/s');
};

// Graceful shutdown
export const closeEmailQueue = async () => {
  if (emailWorker) {
    await emailWorker.close();
    logger.info('Email worker closed');
  }
  await emailQueue.close();
  logger.info('Email queue closed');
};
