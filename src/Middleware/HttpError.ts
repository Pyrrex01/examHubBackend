export class HttpError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    Error.captureStackTrace?.(this, HttpError);
  }

  static badRequest(message = 'Requête invalide.'): HttpError {
    return new HttpError(400, message);
  }

  static unauthorized(message = 'Authentification requise.'): HttpError {
    return new HttpError(401, message);
  }

  static forbidden(message = 'Accès refusé.'): HttpError {
    return new HttpError(403, message);
  }

  static notFound(message = 'Ressource introuvable.'): HttpError {
    return new HttpError(404, message);
  }

  static conflict(message = 'Conflit avec l’état actuel de la ressource.'): HttpError {
    return new HttpError(409, message);
  }
}
