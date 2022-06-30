import winston from 'winston';
import { CloudWatch, default as AWS } from 'aws-sdk';
import type { MetricData } from 'aws-sdk/clients/cloudwatch';
import { Metrics } from './constants';

type Logger = ReturnType<typeof winston.createLogger> & {
  metric: (metric: MetricData) => void;
  startHeartbeat: () => void;
};

AWS.config.update({ region: 'us-east-2' });

const createLogger = (): Logger => {
  const cloudwatchClient = new CloudWatch();
  let heartbeatHandle: NodeJS.Timer | null = null;
  let logger: any = winston.createLogger({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.json(),
      winston.format.printf((info) => `${info.timestamp} | ${info.level}: ${JSON.stringify(info.message)}`)
    ),
    defaultMeta: { service: 'liquidation-client' },
    transports: [
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error'
      }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
      new winston.transports.Console({ level: 'debug' })
    ]
  });

  logger.metric = (metricData: MetricData) => {
    const params = {
      MetricData: metricData,
      Namespace: 'liquidation-client'
    };
    // It's not neccessary to wait this finish.
    cloudwatchClient
      .putMetricData(params)
      .promise()
      .catch((e) => logger.error(e));
  };

  logger.startHeartbeat = () => {
    if (!heartbeatHandle) {
      heartbeatHandle = setInterval(() => logger.metric([{ MetricName: Metrics.Heartbeat, Value: 1 }]), 5000);
    }
  };
  return logger;
};

export const logger = createLogger();
