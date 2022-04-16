import { RedisClient } from '../types';
import { logger } from '../logger';

const refreshBorrowersRedis =
  (client: RedisClient) =>
  async (borrowers: string[]): Promise<void> => {
    logger.debug(`REDIS:got ${borrowers.length} underwater accounts to refresh.`);
    const transaction = client.multi().del('borrowers');
    borrowers.forEach((address) => transaction.sAdd('borrowers', address));
    logger.debug(`REDIS:start refresh transaction.`);
    await transaction.exec();
    logger.debug(`REDIS:refresh done.`);
  };

export default refreshBorrowersRedis;
