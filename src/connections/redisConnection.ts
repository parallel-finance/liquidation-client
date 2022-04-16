import { createClient } from 'redis';
import { logger } from '../logger';
import { RedisClient } from '../types';

const redisConnection = async (redisEnpoint: string): Promise<RedisClient> => {
  const client = createClient({
    url: redisEnpoint
  });
  client.on('error', (err) => logger.error('redis client error', err));
  await client.connect();
  logger.debug('Redis connected.');
  return client;
};

export default redisConnection;
