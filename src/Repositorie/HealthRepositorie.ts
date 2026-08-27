import { query } from '../Database/pool';

export const HealthRepositorie = {
  async fetchServerVersion(): Promise<string> {
    const rows = await query<{ version: string }>(
      'SELECT current_setting($1) AS version',
      ['server_version'],
    );

    return rows[0]?.version ?? 'inconnue';
  },
};
