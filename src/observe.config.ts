import type { ObserveOptions } from '@nestjs/observe';

export type ObserveConfiguration =
  | { enabled: false }
  | { enabled: true; options: ObserveOptions };

export function getObserveConfiguration(
  environment: NodeJS.ProcessEnv,
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
