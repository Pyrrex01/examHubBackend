
export interface DatabaseStatus {
  reachable: boolean;
  version: string | null;
  latencyMs: number | null;
}

export interface ServiceHealth {
  status: 'ok' | 'degraded';
  service: 'exam-hub-backend';
  database: DatabaseStatus;
  timestamp: string;
}
