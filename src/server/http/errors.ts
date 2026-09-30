export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export const badRequest = (msg = "Некорректный запрос", details?: unknown) => new AppError(400, "bad_request", msg, details);
export const unauthorized = (msg = "Нужно войти в аккаунт") => new AppError(401, "unauthorized", msg);
export const forbidden = (msg = "Недостаточно прав") => new AppError(403, "forbidden", msg);
export const notFound = (msg = "Не найдено") => new AppError(404, "not_found", msg);
export const conflict = (msg: string) => new AppError(409, "conflict", msg);
export const tooMany = (msg = "Слишком много запросов. Попробуйте чуть позже.") => new AppError(429, "rate_limited", msg);
