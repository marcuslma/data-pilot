import { ConfigModule, type ConfigService } from '@nestjs/config';
import {
  environmentSchema,
  type EnvironmentConfiguration,
} from './environment.schema.js';

export const applicationConfigurationModule = await ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  validationSchema: environmentSchema,
});

export const bootstrapConfiguration = environmentSchema.parse(process.env);

export type ApplicationConfigService = ConfigService<
  EnvironmentConfiguration,
  true
>;
