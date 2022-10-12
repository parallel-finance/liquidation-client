import { default as pino } from 'pino';
import { default as AWS, CloudWatch } from 'aws-sdk';
import { MERTRIC_NAMESPACE } from './constants';

import type { MetricData, PutMetricDataInput } from 'aws-sdk/clients/cloudwatch';
import type { Logger } from 'pino';

interface LoggerConfig {
  chain: string;
  heartbeatInterval: number; //FIXME(alannotnerd): Deprecated
}

AWS.config.update({ region: 'us-east-2' });

export let logger: Logger<{
  customLevels: {
    metric: number;
  };
}> = null;

export const initLogger = (config: LoggerConfig) => {
  const cloudwatchClient = new CloudWatch();
  const putMetricData = (data: MetricData) => {
    const params: PutMetricDataInput = {
      MetricData: data.map((e) => ({
        ...e,
        Dimensions: [
          {
            Name: 'Chain',
            Value: config.chain
          }
        ]
      })),
      Namespace: MERTRIC_NAMESPACE
    };

    cloudwatchClient
      .putMetricData(params)
      .promise()
      .catch((e) => console.error(e));
  };

  const transport =
    process.env.DEV_LOGS &&
    pino.transport({
      targets: [
        {
          level: 'info',
          target: 'pino-pretty',
          options: {
            colorize: true
          }
        }
      ]
    });

  const instance = pino(
    {
      hooks: {
        logMethod(args: any, method: any) {
          if (typeof args[0] === 'object' && 'metric' in args[0]) {
            const payload = args[0];
            payload.value = 'value' in payload ? payload['value'] : 1;
            putMetricData([{ MetricName: payload['metric'], Value: payload['value'] }]);
          }
          return method.apply(instance, args as any);
        }
      },
      customLevels: {
        metric: 100
      }
    },
    transport
  );

  logger = instance;
  return logger;
};
