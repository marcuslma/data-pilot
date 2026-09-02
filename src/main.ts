import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  AppModule,
  isObserveEnabled,
  ObserveInstrument,
} from './app.module.js';
import { configureApplication } from './application.setup.js';
import type { ApplicationConfigService } from './config/application-configuration.js';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    isObserveEnabled ? { instrument: ObserveInstrument } : {},
  );
  configureApplication(app);

  const configuration = app.get<ApplicationConfigService>(ConfigService);
  await app.listen(configuration.getOrThrow('PORT', { infer: true }));
}
await bootstrap();
