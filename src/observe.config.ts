import type { ObserveOptions } from '@nestjs/observe';
import type { EnvironmentConfiguration } from './config/environment.schema.js';

export type ObserveConfiguration =
  | { enabled: false }
  | { enabled: true; options: ObserveOptions };

export function getObserveConfiguration(
  environment: Pick<
    EnvironmentConfiguration,
    'OBSERVE_APP_KEY' | 'OBSERVE_APP_SECRET' | 'OBSERVE_SERVICE_ID'
  >,
): ObserveConfiguration {
  const appKey = environment.OBSERVE_APP_KEY;
  const appSecret = environment.OBSERVE_APP_SECRET;

  if (!appKey || !appSecret) {
    return { enabled: false };
  }

  return {
    enabled: true,
    options: {
      appKey,
      appSecret,
      serviceId: environment.OBSERVE_SERVICE_ID ?? 'data-pilot',
    },
  };
}
