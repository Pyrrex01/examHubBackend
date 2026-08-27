import { HttpError } from './HttpError';

export class Validator {
  private readonly source: Record<string, unknown>;
  private readonly errors: string[] = [];

  constructor(body: unknown, private readonly label = 'Données invalides') {
    this.source =
      typeof body === 'object' && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};

    if (body !== undefined && (typeof body !== 'object' || body === null || Array.isArray(body))) {
      this.errors.push('le corps de la requête doit être un objet JSON');
    }
  }

  private fail(field: string, reason: string): void {
    this.errors.push(`${field} ${reason}`);
  }

  private raw(field: string): unknown {
    return this.source[field];
  }

  private missing(value: unknown): boolean {
    return value === undefined || value === null || value === '';
  }


  string(
    field: string,
    options: {
      min?: number;
      max?: number;
      optional?: boolean;
      default?: string;
      pattern?: RegExp;
      patternMessage?: string;
    } = {},
  ): string {
    const { min = 1, max = 255, optional = false } = options;
    const value = this.raw(field);

    if (this.missing(value)) {
      if (optional) return options.default ?? '';
      this.fail(field, 'est requis');
      return '';
    }

    if (typeof value !== 'string') {
      this.fail(field, 'doit être une chaîne de caractères');
      return '';
    }

    const trimmed = value.trim();

    if (trimmed.length < min) {
      this.fail(
        field,
        min === 1 ? 'ne doit pas être vide' : `doit comporter au moins ${min} caractères`,
      );
      return trimmed;
    }

    if (trimmed.length > max) {
      this.fail(field, `ne doit pas dépasser ${max} caractères`);
      return trimmed.slice(0, max);
    }

    if (options.pattern && !options.pattern.test(trimmed)) {
      this.fail(field, options.patternMessage ?? "n'a pas le format attendu");
      return trimmed;
    }

    return trimmed;
  }

  integer(
    field: string,
    options: { min?: number; max?: number; optional?: boolean; default?: number } = {},
  ): number {
    const { min, max, optional = false } = options;
    const value = this.raw(field);

    if (this.missing(value)) {
      if (optional) return options.default ?? 0;
      this.fail(field, 'est requis');
      return 0;
    }

    const parsed = typeof value === 'string' ? Number(value.trim()) : value;

    if (typeof parsed !== 'number' || !Number.isInteger(parsed)) {
      this.fail(field, 'doit être un nombre entier');
      return 0;
    }

    if (min !== undefined && parsed < min) {
      this.fail(field, `doit être supérieur ou égal à ${min}`);
      return parsed;
    }

    if (max !== undefined && parsed > max) {
      this.fail(field, `doit être inférieur ou égal à ${max}`);
      return parsed;
    }

    return parsed;
  }

  boolean(field: string, options: { optional?: boolean; default?: boolean } = {}): boolean {
    const value = this.raw(field);

    if (value === undefined || value === null) {
      if (options.optional) return options.default ?? false;
      this.fail(field, 'est requis');
      return false;
    }

    if (typeof value !== 'boolean') {
      this.fail(field, 'doit être un booléen (true ou false)');
      return false;
    }

    return value;
  }

  email(field: string, options: { optional?: boolean } = {}): string {
    const value = this.string(field, { max: 254, optional: options.optional });
    if (value === '') return '';

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      this.fail(field, "n'est pas une adresse email valide");
      return '';
    }

    return value.toLowerCase();
  }

  password(field: string, options: { min?: number; optional?: boolean } = {}): string {
    const { min = 8, optional = false } = options;
    const value = this.raw(field);

    if (this.missing(value)) {
      if (optional) return '';
      this.fail(field, 'est requis');
      return '';
    }

    if (typeof value !== 'string') {
      this.fail(field, 'doit être une chaîne de caractères');
      return '';
    }

    if (value.length < min) {
      this.fail(field, `doit comporter au moins ${min} caractères`);
      return '';
    }

    if (value.length > 200) {
      this.fail(field, 'ne doit pas dépasser 200 caractères');
      return '';
    }

    return value;
  }

  oneOf<T extends string>(
    field: string,
    allowed: readonly T[],
    options: { optional?: boolean; default?: T } = {},
  ): T {
    const value = this.raw(field);

    if (this.missing(value)) {
      if (options.optional && options.default !== undefined) return options.default;
      if (options.optional) return allowed[0] as T;
      this.fail(field, 'est requis');
      return allowed[0] as T;
    }

    if (typeof value !== 'string' || !allowed.includes(value as T)) {
      this.fail(field, `doit valoir : ${allowed.join(', ')}`);
      return allowed[0] as T;
    }

    return value as T;
  }

  dateTime(field: string, options: { optional?: boolean } = {}): Date | null {
    const value = this.raw(field);

    if (this.missing(value)) {
      if (options.optional) return null;
      this.fail(field, 'est requis');
      return null;
    }

    if (typeof value !== 'string') {
      this.fail(field, 'doit être une date au format ISO 8601');
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      this.fail(field, "n'est pas une date valide (format ISO 8601 attendu)");
      return null;
    }

    return parsed;
  }

  array(
    field: string,
    options: { min?: number; max?: number; optional?: boolean } = {},
  ): unknown[] {
    const { min = 0, max = 1000, optional = false } = options;
    const value = this.raw(field);

    if (value === undefined || value === null) {
      if (optional) return [];
      this.fail(field, 'est requis');
      return [];
    }

    if (!Array.isArray(value)) {
      this.fail(field, 'doit être un tableau');
      return [];
    }

    if (value.length < min) {
      this.fail(field, `doit comporter au moins ${min} élément(s)`);
      return value;
    }

    if (value.length > max) {
      this.fail(field, `ne doit pas comporter plus de ${max} élément(s)`);
      return value;
    }

    return value;
  }

  reject(field: string, reason: string): void {
    this.fail(field, reason);
  }


  get valid(): boolean {
    return this.errors.length === 0;
  }

  throwIfInvalid(): void {
    if (this.errors.length === 0) return;
    throw HttpError.badRequest(`${this.label} : ${this.errors.join(' ; ')}.`);
  }
}

export function parseResourceId(value: unknown, name = 'identifiant'): number {
  const parsed = typeof value === 'string' ? Number(value) : value;

  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < 1) {
    throw HttpError.badRequest(`L'${name} fourni est invalide : un entier positif est attendu.`);
  }

  return parsed;
}
