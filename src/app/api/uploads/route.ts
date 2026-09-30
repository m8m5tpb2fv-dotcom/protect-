import { api } from "@/server/http/handler";
import { requireUser } from "@/server/auth/session";
import { badRequest, tooMany } from "@/server/http/errors";
import { rateLimit } from "@/server/http/rate-limit";
import { processUpload, UPLOAD_PURPOSES, type UploadPurpose } from "@/server/storage/upload";

export const POST = api(async (req) => {
  const user = await requireUser();
  if (!rateLimit(`upload:${user.id}`, 40, 10 * 60_000).ok) throw tooMany("Слишком много загрузок. Подождите немного.");
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 62 * 1024 * 1024) throw badRequest("Файл слишком большой");
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("Ожидалась форма с файлом");
  }
  const file = form.get("file");
  const purpose = String(form.get("purpose") ?? "");
  if (!(file instanceof File)) throw badRequest("Файл не передан");
  if (!(purpose in UPLOAD_PURPOSES)) throw badRequest("Неизвестное назначение файла");
  if ((purpose === "portfolio" || purpose === "cover" || purpose === "document" || purpose === "promo") && !user.provider) throw badRequest("Сначала создайте профиль исполнителя");
  return processUpload(user.id, purpose as UploadPurpose, file);
});
