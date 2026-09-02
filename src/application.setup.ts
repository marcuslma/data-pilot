import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';

export function configureApplication(app: INestApplication): void {
  app.enableCors();
  app.useGlobalPipes(new StandardSchemaValidationPipe());
}
