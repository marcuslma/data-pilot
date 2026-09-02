import { NestFactory } from '@nestjs/core';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import {
  AppModule,
  isObserveEnabled,
  ObserveInstrument,
} from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    isObserveEnabled ? { instrument: ObserveInstrument } : {},
  );
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
