import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { getObserveConfiguration } from './observe.config.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();
const observeConfiguration = getObserveConfiguration(process.env);
export const isObserveEnabled = observeConfiguration.enabled;

@Module({
  imports: observeConfiguration.enabled
    ? [ObserveModule.forRoot(observeConfiguration.options)]
    : [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
