# Рядом — локальные услуги Саратова

Маркетплейс спроса и предложения: «мне нужна услуга → я быстро нахожу человека, который её выполнит».
Один фронтенд работает в мобильном и десктопном браузере, на планшете и как **Telegram Mini App**.

> Название, слоган, комиссия и город по умолчанию вынесены в `src/config/app.ts` и `.env`.

---

## 1. Что реализовано

**Клиент**
- Главная: «Что нужно сделать?», умный поиск с подсказками (услуги, специализации, исполнители), популярные задачи, bento-категории, «Срочно», подборки «Лучшие / Свободны сейчас / Новые».
- Каталог `/services`, SEO-страницы категорий и специализаций `/services/[slug]` (цены, JSON-LD `ItemList`, фильтры, карта).
- Поиск `/search`: полнотекстовый (pg_trgm + словарь синонимов), фильтры (район, свободен сейчас, проверенные, сортировки), «Рядом со мной» (геолокация браузера / Telegram LocationManager), список + карта.
- Профиль исполнителя `/provider/[slug]`: обложка, верификация, bento-метрики (рейтинг, заказы, клиенты, % повторных, время ответа, опыт), услуги и цены, masonry-портфолио с лайтбоксом (фото/видео), отзывы с распределением оценок, география с радиусом на карте, график, похожие исполнители, жалоба, «Поделиться» (в Telegram — deep link), JSON-LD.
- Мастер заявки `/order/new` (6 шагов): специализация → задача → описание и фото → адрес/район/геолокация → срочность и бюджет → проверка. Черновик сохраняется при переходе на вход. Прямой заказ конкретному исполнителю. В Telegram — нативная MainButton.
- Заказы `/orders`, `/orders/[id]`: статусы (Новая → Отклики → Исполнитель выбран → В работе → Завершён / Отменён), таймлайн, отклики с выбором, подходящие исполнители рядом, контакты раскрываются только после выбора, подтверждение выполнения, отзыв с фото.
- Чат `/messages`: список + диалог (двухпанельный на десктопе), фото, статусы «отправлено/прочитано», время, автообновление; схема сообщений готова к голосовым, файлам и геолокации (`message_kind`).
- Уведомления `/notifications` (in-app + Telegram-бот + email для важных), избранное, настройки (имя, аватар, район, каналы уведомлений, тема), поддержка с FAQ и обращениями.

**Исполнитель**
- «Стать исполнителем» — 4-шаговая анкета → «Профиль на проверке».
- Кабинет `/pro`: статус модерации, переключатель «Свободен/Занят», метрики, заявки рядом (по специализациям, району и радиусу; адрес замаскирован до выбора), прямые заказы (принять / не смогу), заказы в работе.
- Редактор профиля, документы для верификации (приватное хранилище), услуги и цены, портфолио (фото/видео), продвижение и Pro (`/pro/billing`) с промокодами.
- Лимит бесплатных откликов (30/мес), безлимит в Pro. Комиссия начисляется с завершённых заказов.

**Админ-панель `/admin`** (роли admin / moderator)
- Обзор: пользователи, исполнители, заказы (активные/завершённые), GMV, комиссия, средний чек, конверсии, время ответа, новые пользователи, популярные категории и районы, графики по дням.
- Модерация исполнителей (одобрить / отклонить с комментарием / приостановить / уровни проверки, просмотр документов), пользователи (блокировка, роли), заказы (отмена), отзывы (скрыть), жалобы, обращения (ответ → уведомление), платежи (Demo/Production явно помечены), промокоды, категории и специализации, города и районы, контент (тексты главной, FAQ), журнал действий администраторов.

**Платформа**: PWA (manifest, иконки, service worker, офлайн-экран), тёмная/светлая/системная/Telegram тема, sitemap/robots, ошибки 404/500/offline, скелетоны, reduced motion, клавиатурная навигация, ARIA.

## 2. Архитектура

```
src/
  app/                 Next.js App Router: страницы (RSC) + /api (route handlers)
    api/               REST API: auth, orders, conversations, uploads, provider, payments, admin, telegram
    art/…              детерминированные SVG-иллюстрации для демо-данных
    files/[...key]     раздача загруженных файлов (private/* — никогда)
  components/          ui/ (примитивы), layout/, domain/, maps/ (адаптеры карт), telegram/, admin/
  config/app.ts        бренд, комиссия, тарифы
  lib/                 общий код клиента и сервера: форматирование, валидация (zod), deep links, гео
  server/
    db/                Drizzle schema, клиент, seed (справочники + демо)
    auth/              сессии, пароли (scrypt), email/телефон/Telegram
    http/              обёртка API: CSRF, rate limit, ошибки, валидация
    services/          бизнес-логика: providers/search, orders, chat, account, admin, provider-self
    payments/          абстракция платёжного шлюза: sandbox | ЮKassa
    storage/           абстракция хранилища: local | S3; обработка изображений (sharp)
    notifications/     in-app + Telegram + email/SMS каналы
    telegram/          Bot API, проверка initData, обработчики webhook
drizzle/               SQL-миграции
scripts/               migrate, seed, reset, telegram-setup, icons, shot (скриншоты)
tests/                 vitest: unit + интеграционные тесты на реальной PostgreSQL
```

Ключевые решения:
- **Один Next.js-проект** (SSR для SEO-страниц + API) — проще деплой, одна кодовая база для web и Mini App.
- **Сервисный слой** не зависит от HTTP: его используют и страницы (RSC), и API, и тесты.
- **Город — сущность** (`cities`, `districts`); Энгельс, Самара, Волгоград, Казань уже в базе со статусом «скоро» и включаются в админке.
- **Таксономия**: `categories` (12 групп) → `subcategories` (48 специализаций) → `services` (100+ типовых задач с ценами).
- **Поиск**: `pg_trgm` по денормализованному `search_text` + сопоставление запроса со справочником (синонимы/ключевые слова), байесовский рейтинг, поднятые (оплаченные) профили помечены «Реклама».
- **Карты**: интерфейс `MapAdapter` с реализациями Leaflet/OSM (без ключа), Яндекс Карты v3, 2ГИС MapGL.
- **Реалтайм** чата и счётчиков — polling (работает на любом хостинге, в т. ч. serverless). Точка расширения — SSE/WebSocket.

### База данных (PostgreSQL)
`users, sessions, otp_codes, locations, cities, districts, categories, subcategories, services, providers, provider_subcategories, provider_districts, provider_services, portfolio_items, provider_documents, orders, order_photos, order_events, order_responses, conversations, messages, reviews, favorites, notifications, payments, subscriptions, promotions, promo_codes, reports, support_tickets, admin_actions, content_blocks`.

## 3. Стек
Next.js 16 (App Router, React 19, TypeScript) · Tailwind CSS 4 (собственная дизайн-система) · PostgreSQL 14+ · Drizzle ORM · zod · sharp · Leaflet · lucide · Vitest · Playwright (скриншоты).

Почему Drizzle, а не Prisma: без бинарных движков и генерации клиента, SQL-first (pg_trgm, haversine), быстрый холодный старт.

## 4. Локальный запуск

```bash
cp .env.example .env               # заполните SESSION_SECRET и ADMIN_PASSWORD
docker compose up -d db            # или свой PostgreSQL
npm install
npm run db:migrate
npm run db:seed -- --demo          # справочники, админ из .env и демо-данные Саратова
npm run dev                        # http://localhost:3000
```
Полный сброс: `npm run db:reset`. Всё в Docker: `docker compose up -d --build`.

## 5. `.env.example`
См. файл [`.env.example`](./.env.example) — все переменные прокомментированы. Секреты не коммитятся (`.gitignore`).

## 6. Telegram Bot
1. `@BotFather` → `/newbot` → получите токен → `TELEGRAM_BOT_TOKEN`, имя → `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`.
2. Придумайте `TELEGRAM_WEBHOOK_SECRET` (случайная строка).
3. Задеплойте приложение по **HTTPS**, укажите `APP_URL`.
4. `npm run telegram:setup` — установит webhook (`/api/telegram/webhook`, проверка секретного заголовка), команды `/start /new /orders /pro` и кнопку меню, открывающую Mini App.

Бот: `/start [payload]` отвечает кнопкой открытия нужного экрана (`/start provider_<slug>` и т. п.), фиксирует разрешение на сообщения; уведомления приходят с кнопкой «Открыть» прямо в Mini App.

## 7. Mini App
1. `@BotFather` → `/newapp` → выберите бота, URL = `APP_URL`, короткое имя → `NEXT_PUBLIC_TELEGRAM_APP_NAME`.
2. Ссылка: `https://t.me/<bot>/<app>`. Deep links: `?startapp=provider_<slug>`, `order_<uuid>`, `category_<slug>`, `service_<slug>`, `chat_<uuid>`.

Как это работает: инлайн-скрипт в `<head>` определяет запуск из Telegram (`tgWebAppData`) и подгружает SDK только там. `TelegramProvider` вызывает `ready/expand`, маппит тему Telegram на токены дизайн-системы, учитывает safe areas (`safeAreaInset` + `contentSafeAreaInset`), управляет `BackButton`, `MainButton` (мастер заявки, анкета исполнителя), haptic feedback и автоматически логинит пользователя: `initData` проверяется на сервере по HMAC (`WebAppData` + токен бота, срок годности 24 ч) — `initDataUnsafe` не используется для авторизации. Если в браузере уже есть сессия без Telegram, аккаунты связываются. Cookie в HTTPS выставляется `SameSite=None; Secure; Partitioned` (для Telegram Web в iframe), плюс fallback на Bearer-токен.

## 8. База данных
Любой PostgreSQL 14+ (Neon, Supabase, Yandex Managed PostgreSQL, свой). Нужно расширение `pg_trgm` (создаётся миграцией; на managed-сервисах оно разрешено). `DATABASE_URL=...` → `npm run db:migrate`. Новая миграция после изменения схемы: `npm run db:generate`.

## 9. Хранилище
- `STORAGE_DRIVER=local` — файлы в `STORAGE_LOCAL_DIR` (для VPS смонтируйте том).
- `STORAGE_DRIVER=s3` — любой S3-совместимый (Yandex Object Storage, Selectel, MinIO, AWS): `S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` (CDN). В БД всегда хранится путь `/files/<key>`, поэтому смена драйвера не требует миграции данных. Ключи `private/` (документы) не отдаются публично.
- Загрузки: проверка по сигнатуре файла (не по MIME клиента), лимиты размера и пикселей, перекодирование в WebP с удалением EXIF/GPS, rate limit.

## 10. Карты
`NEXT_PUBLIC_MAP_PROVIDER=leaflet` (по умолчанию, OSM/CARTO, ключ не нужен) | `yandex` (+`NEXT_PUBLIC_YANDEX_MAPS_API_KEY`) | `2gis` (+`NEXT_PUBLIC_2GIS_API_KEY`). Добавить провайдера — реализовать `MapAdapter` в `src/components/maps/adapters.ts`. При ошибке загрузки провайдера — фолбэк на Leaflet.

## 11. Платежи
Абстракция `PaymentGateway` (`src/server/payments`).
- `PAYMENT_GATEWAY=sandbox` (по умолчанию) — **тестовый** шлюз: страница `/pay/sandbox/<id>` с огромной пометкой «Тестовая оплата», кнопки «успех / ошибка». В кабинете и админке платежи помечены «тест».
- `PAYMENT_GATEWAY=yookassa` + `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY` — реальные платежи (redirect-подтверждение, idempotence key). Webhook: `POST /api/payments/yookassa` — статус всегда перепроверяется запросом к API ЮKassa. Выдача услуги идемпотентна.
Продукты: подписка Pro, поднятие 24ч/7д, выделение карточки; промокоды.

## 12. Деплой
- **VPS/Docker**: `docker compose up -d --build` (приложение + PostgreSQL, миграции при старте). Поставьте перед ним Caddy/Nginx с HTTPS.
- **Vercel**: подключите репозиторий, задайте переменные, внешняя PostgreSQL, `STORAGE_DRIVER=s3` (файловая система Vercel эфемерна). Выполните `npm run db:migrate` из CI.
- `GET /api/health` — health-check (проверяет БД).

## 13. Готово и работает
Всё из раздела 1: регистрация/вход (email, телефон с кодом, Telegram), заявки и отклики, выбор исполнителя, статусы, чат с фото и прочтением, уведомления (in-app, Telegram), отзывы, избранное, анкета и кабинет исполнителя, модерация, аналитика, промокоды, sandbox-оплата с реальной выдачей услуг, загрузка и обработка файлов, поиск, геолокация, карты, PWA.

## 14. Что пока mock / требует ключей
| Функция | Сейчас | Для production |
|---|---|---|
| SMS-коды | `SMS_PROVIDER=console`: код в логе и (в DEMO_MODE) на экране | `SMS_PROVIDER=smsru` + `SMSRU_API_KEY` |
| Email | `console` | `EMAIL_PROVIDER=resend` + ключ |
| Оплата | sandbox (явно помечен) | ЮKassa |
| Telegram | без токена сообщения только логируются | токен + webhook |
| Фото в демо-данных | сгенерированные SVG-иллюстрации (без реальных людей) | фото загружают исполнители |
| Оплата комиссии исполнителем | начисляется на баланс, списание не подключено | подключить после выбора модели расчётов |

## 15. Перед production
- `DEMO_MODE=false` (выключает демо-вход и показ кодов), сильный `SESSION_SECRET`, HTTPS, резервные копии БД.
- Не загружать демо-данные (`npm run db:seed` без `--demo`).
- Подключить SMS, email, ЮKassa, S3, Telegram-бота; Яндекс Карты при необходимости.
- Rate limiter — in-memory: для нескольких инстансов вынести в Redis (интерфейс в `src/server/http/rate-limit.ts`).
- Мониторинг ошибок (Sentry) — `src/server/log.ts`; при желании строгий CSP с nonce.
- Юридическое: оферта, политика ПДн (152-ФЗ, хранение данных в РФ), согласие на обработку.

## 16. Тестовые аккаунты (только с демо-данными)
| Роль | Вход |
|---|---|
| Клиент (Анна Лебедева) | кнопка «Клиент» на `/login` или `client@demo.ryadom.local` / `demo-password` |
| Исполнитель (Алексей Морозов, сантехник) | кнопка «Исполнитель» или `provider@demo.ryadom.local` / `demo-password` |
| Администратор | `ADMIN_EMAIL` / `ADMIN_PASSWORD` из `.env` |

## 17. Администратор
Администратор создаётся из переменных окружения `ADMIN_EMAIL` и `ADMIN_PASSWORD` (≥10 символов) при `npm run db:seed` или отдельно `npm run admin:create` (повторный запуск обновляет пароль). Пароль нигде не захардкожен. Модераторов назначает администратор в разделе «Пользователи».

## Проверки
```bash
npm run lint && npm run typecheck && npm test && npm run build
```
Тесты используют отдельную БД `ryadom_test` (`TEST_DATABASE_URL`): unit (initData, телефоны, deep links, валидация, пароли, rate limit) и интеграционные сценарии A/B, права доступа, авторизация, платежи.
