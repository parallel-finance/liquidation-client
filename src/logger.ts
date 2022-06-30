import winston from 'winston';
import { CloudWatch, default as AWS } from 'aws-sdk';
import type { MetricData, PutMetricDataInput } from 'aws-sdk/clients/cloudwatch';
import { Metrics } from './constants';

type Logger = ReturnType<typeof winston.createLogger> & {
  metric: (metric: MetricData) => void;
  startHeartbeat: () => void;
};

interface LoggerConfig {
  chain: string;
  heartbeatInterval: number;
}

AWS.config.update({ region: 'us-east-2' });

export let logger: Logger = null;

export const initLogger = (config: LoggerConfig) => {
  const cloudwatchClient = new CloudWatch();
  let heartbeatHandle: NodeJS.Timer | null = null;
  let instance: any = winston.createLogger({
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

  instance.metric = (metricData: MetricData) => {
    const params: PutMetricDataInput = {
      MetricData: metricData.map((e) => ({
        ...e,
        Dimensions: [
          {
            Name: 'Chain',
            Value: config.chain
          }
        ]
      })),
      Namespace: 'liquidation-client'
    };
    // It's not neccessary to wait this finish.
    cloudwatchClient
      .putMetricData(params)
      .promise()
      .catch((e) => instance.error(e));
  };

  instance.startHeartbeat = () => {
    if (!heartbeatHandle) {
      heartbeatHandle = setInterval(
        () => instance.metric([{ MetricName: Metrics.Heartbeat, Value: 1 }]),
        config.heartbeatInterval
      );
    }
  };
  logger = instance;
};
