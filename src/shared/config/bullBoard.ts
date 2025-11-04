import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { orderExpirationQueue } from '../queues/orderExpiration.queue';
import { emailQueue } from '../queues/email.queue';
import { cartCleanupQueue } from '../queues/cartCleanup.queue';

export const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

export const bullBoard = createBullBoard({
  queues: [
    new BullMQAdapter(orderExpirationQueue),
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(cartCleanupQueue),
  ],
  serverAdapter,
});

export const bullBoardRouter = serverAdapter.getRouter();
