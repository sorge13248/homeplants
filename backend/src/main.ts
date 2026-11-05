import 'reflect-metadata';
import './load-env';
import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: (process.env.CORS_ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      credentials: true,
    },
  });

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'api/quick-action/(.*)', method: RequestMethod.ALL },
    ],
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`🌿 HomePlants backend running on http://localhost:${port}`);
}

void bootstrap();

