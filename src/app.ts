import express, { type Application } from 'express';
import cors from 'cors';

import { env } from './Config/env';
import { authRouter } from './Controller/AuthController';
import { courseRouter } from './Controller/CourseController';
import { examRouter } from './Controller/ExamController';
import { healthRouter } from './Controller/HealthController';
import { myExamRouter } from './Controller/MyExamController';
import { questionRouter } from './Controller/QuestionController';
import { resultRouter } from './Controller/ResultController';
import { studentRouter } from './Controller/StudentController';
import { errorHandler, notFoundHandler } from './Middleware/errorHandler';
import { requestLogger } from './Middleware/requestLogger';

export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: false,
    }),
  );

  app.use(requestLogger);

  app.use(express.json({ limit: '256kb' }));

  app.use('/api', healthRouter);
  app.use('/api', authRouter);

  app.use('/api', studentRouter);
  app.use('/api', courseRouter);
  app.use('/api', examRouter);
  app.use('/api', questionRouter);

  app.use('/api', myExamRouter);

  app.use('/api', resultRouter);


  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
