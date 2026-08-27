import type { Server } from 'node:http';

function main(): void {
  const { env } = require('./Config/env') as typeof import('./Config/env');
  const { createApp } = require('./app') as typeof import('./app');
  const { closePool, describeConnection } =
    require('./Database/pool') as typeof import('./Database/pool');
  const { HealthService } =
    require('./Service/HealthService') as typeof import('./Service/HealthService');

  const app = createApp();

  const server: Server = app.listen(env.port, () => {
    console.log(
      `[exam-hub] API démarrée sur http://localhost:${env.port}/api (env: ${env.nodeEnv})`,
    );

    void HealthService.isDatabaseReachable().then((up) => {
      console.log(
        up
          ? `[exam-hub] PostgreSQL joignable (${describeConnection()})`
          : `[exam-hub] PostgreSQL INJOIGNABLE (${describeConnection()}) — lancez « npm run db:up »`,
      );
    });
  });

  const shutdown = (signal: string): void => {
    console.log(`[exam-hub] Signal ${signal} reçu, arrêt en cours…`);
    server.close((error) => {
      if (error) {
        console.error('[exam-hub] Erreur pendant l’arrêt :', error);
        process.exit(1);
      }
      closePool()
        .then(() => {
          console.log('[exam-hub] Serveur arrêté, pool PostgreSQL fermé.');
          process.exit(0);
        })
        .catch(() => process.exit(1));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

try {
  main();
} catch (error) {
  console.error(
    '[exam-hub] Démarrage impossible :',
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
