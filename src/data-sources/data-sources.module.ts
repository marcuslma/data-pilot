import { Module } from '@nestjs/common';
import { MongoClient } from 'mongodb';
import { Client } from 'pg';
import { DATA_SOURCE_ADAPTERS } from './data-source.adapter.js';
import { DataSourceRegistry } from './data-source.registry.js';
import { DataSourceService } from './data-source.service.js';
import { DataSourcesController } from './data-sources.controller.js';
import {
  MONGODB_CLIENT_FACTORY,
  MongoDbAdapter,
  type MongoDbClientFactory,
} from './mongodb.adapter.js';
import {
  POSTGRES_CLIENT_FACTORY,
  PostgresAdapter,
  type PostgresClientFactory,
} from './postgres.adapter.js';
import { RuntimeAccessGuard } from './runtime-access.guard.js';

const postgresClientFactory: PostgresClientFactory = (connectionUrl) =>
  new Client({ connectionString: connectionUrl });

const mongoDbClientFactory: MongoDbClientFactory = (connectionUrl) =>
  new MongoClient(connectionUrl);

@Module({
  controllers: [DataSourcesController],
  providers: [
    PostgresAdapter,
    MongoDbAdapter,
    {
      provide: POSTGRES_CLIENT_FACTORY,
      useValue: postgresClientFactory,
    },
    {
      provide: MONGODB_CLIENT_FACTORY,
      useValue: mongoDbClientFactory,
    },
    {
      provide: DATA_SOURCE_ADAPTERS,
      useFactory: (postgres: PostgresAdapter, mongo: MongoDbAdapter) => [
        postgres,
        mongo,
      ],
      inject: [PostgresAdapter, MongoDbAdapter],
    },
    DataSourceRegistry,
    DataSourceService,
    RuntimeAccessGuard,
  ],
  exports: [DataSourceService],
})
export class DataSourcesModule {}
