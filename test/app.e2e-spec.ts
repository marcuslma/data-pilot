import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { configureApplication } from './../src/application.setup.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('allows an unrestricted CORS preflight request', () => {
    return request(app.getHttpServer())
      .options('/ask')
      .set('Origin', 'https://any-client.example')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)
      .expect('access-control-allow-origin', '*')
      .expect((response) => {
        expect(response.headers['access-control-allow-credentials']).toBeUndefined();
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
