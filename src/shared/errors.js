export class AppError extends Error {
  constructor(status, message, code = 'VALIDATION_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function requireUser(user) {
  if (!user) throw new AppError(401, 'Inicia sesión para continuar.', 'UNAUTHENTICATED');
  return user;
}

export function requireOrganizer(user) {
  requireUser(user);
  if (user.role !== 'organizer') {
    throw new AppError(403, 'Necesitas una cuenta de organizador para publicar.', 'FORBIDDEN');
  }
}

export function text(value, label, min, max) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new AppError(400, `${label}: debe contener entre ${min} y ${max} caracteres.`);
  }
  return value.trim();
}
