import { HealthRepositorie } from '../Repositorie/HealthRepositorie';
import type { ServiceHealth } from '../Model/Health';

export const HealthService = {
  async inspect(): Promise<ServiceHealth> {
    const startedAt = Date.now();

    try {
      const version = await HealthRepositorie.fetchServerVersion();

      return {
        status: 'ok',
        service: 'exam-hub-backend',
        database: {
          reachable: true,
          version,
          latencyMs: Date.now() - startedAt,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        '[health] PostgreSQL injoignable :',
        error instanceof Error ? error.message : error,
      );

      return {
        status: 'degraded',
        service: 'exam-hub-backend',
        database: { reachable: false, version: null, latencyMs: null },
        timestamp: new Date().toISOString(),
      };
    }
  },

  async isDatabaseReachable(): Promise<boolean> {
    const health = await this.inspect();
    return health.database.reachable;
  },
};
