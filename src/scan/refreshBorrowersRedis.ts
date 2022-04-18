import { RedisClient } from '../types';
import { logger } from '../logger';

const SEY_KEY = 'borrowers';

const refreshBorrowersRedis =
  (client: RedisClient) =>
  async (borrowers: string[]): Promise<void> => {
    logger.debug(`REDIS:got ${borrowers.length} underwater accounts to refresh.`);
    const transaction = client.multi().del(SEY_KEY);
    if (borrowers.length > 0) {
      transaction.sAdd(SEY_KEY, borrowers);
    }
    logger.debug(`REDIS:start refresh transaction.`);
    await transaction.exec();
    logger.debug(`REDIS:refresh done.`);
  };

export default refreshBorrowersRedis;
