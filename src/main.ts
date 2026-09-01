import { NestFactory } from '@nestjs/core';
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
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
