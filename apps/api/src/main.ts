import type { Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

const vercelOrigin = /^https:\/\/social-network-chain(?:-[a-z0-9]+)?-danielolan1s-projects\.vercel\.app$/;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || !corsOrigin?.length || corsOrigin.includes(origin) || vercelOrigin.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  const config = new DocumentBuilder()
    .setTitle('Social Network API')
    .setDescription('Executable API reference for Social Network backend')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  app
    .getHttpAdapter()
    .get('/docs-json', (_req: Request, res: Response) => res.json(document));
  app.use(
    '/docs',
    apiReference({
      spec: {
        url: '/docs-json',
      },
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
