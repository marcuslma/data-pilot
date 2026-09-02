import { getObserveConfiguration } from './observe.config.js';

describe('getObserveConfiguration', () => {
  it('disables observability when credentials are missing', () => {
    expect(
      getObserveConfiguration({ OBSERVE_SERVICE_ID: 'data-pilot' }),
    ).toEqual({ enabled: false });
  });

  it('enables observability only when both credentials are configured', () => {
    expect(
      getObserveConfiguration({
        OBSERVE_APP_KEY: 'app-key',
        OBSERVE_APP_SECRET: 'app-secret',
        OBSERVE_SERVICE_ID: 'custom-service',
      }),
    ).toEqual({
      enabled: true,
      options: {
        appKey: 'app-key',
        appSecret: 'app-secret',
        serviceId: 'custom-service',
      },
    });
  });
});
