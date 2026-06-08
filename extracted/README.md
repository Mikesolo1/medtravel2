# Taurus Medical Experts — Лечение в Израиле

Медицинский портал для организации лечения в Израиле. Подбор врача под диагноз, клиники, направления, консультации. Статический фронтенд + Node.js/SQLite backend + админ-панель.

---

## Архитектура

```
Браузер ──► Nginx ──┬── /            → статические HTML/CSS/JS
                    ├── /tables/     → tables-server.js  (SQLite REST API, :8788)
                    └── /admin/      → publish-server.js (генерация SEO-страниц, :8787)
```

- **Фронтенд:** статический HTML5 + vanilla JS (ES6), без сборки.
- **Backend:** Node.js, `tables-server.js` хранит данные в SQLite (`better-sqlite3`) и отдаёт REST API в формате `{data:[...], total, page, limit}`.
- **Контент:** `engine.js` накладывает редактируемый контент из БД (`page_content`) поверх статического HTML.
- **Деплой:** Ubuntu 24.04 + Nginx + systemd + Let's Encrypt. Подробно — `server/DEPLOY.md`.

---

## База данных (8 таблиц)

| Таблица | Назначение |
|---|---|
| `doctors` | Врачи (127 записей) |
| `clinics` | Клиники (7 записей) |
| `treatments` | Направления (17 записей) |
| `doctor_treatments` | Связь врач ↔ направление (pivot) |
| `page_content` | Редактируемый контент страниц (35 страниц) |
| `site_settings` | Настройки (Telegram, контакты, пароль админки) |
| `form_submissions` | Заявки с UTM-метками |
| `seo_publish_logs` | Логи публикации SEO-страниц |

### Врачи — 127 записей

Импортированы из `база врачей.csv`. Распределение по направлениям:

| Направление | Врачей |
|---|---|
| Онкология | 18 |
| Урология | 13 |
| Гастроэнтерология и гепатология | 12 |
| Гинекология и репродуктология | 12 |
| Отоларингология (ЛОР) | 12 |
| Гематология | 9 |
| Стоматология | 9 |
| Кардиология | 8 |
| Эндокринология | 8 |
| Дерматология | 5 |
| Неврология | 5 |
| Аллергология и иммунология | 4 |
| Генетика | 4 |
| Проктология | 4 |
| Терапия | 3 |
| Гериатрия | 1 |

Распределение по клиникам (с собственными страницами): Ихилов (Сураски) — 48, Шиба — 18, Рабин (Бейлинсон) — 13, Ассута — 7, Медика — 4, Герцлия — 3, Вольфсон — 3. Ещё 31 врач работает в клиниках без отдельной страницы (имя клиники сохранено в карточке).

---

## Страницы

### Основные
- **index.html** — главная (hero, направления, преимущества, процесс, второе мнение, FAQ)
- **o-nas.html** — о нас
- **kliniki-izrailya.html** — каталог клиник (7)
- **otdeleniya.html** — все направления (ссылки на 16 страниц направлений + онкология)
- **vrachi.html** — каталог врачей с фильтром по специальностям (динамическая загрузка из API)
- **onkologiya.html** — онкология (с динамической секцией «Наши онкологи»)
- **patsientam.html** + 3 подстраницы — информация для пациентов
- **otzyvy.html** — отзывы
- **kontakty.html** — контакты и формы
- **admin.html** — админ-панель

### Клиники (`kliniki/`, 7 страниц)
ikhilov-sourasky, sheba-tel-hashomer, rabin-beilinson, wolfson, assuta, herzliya-medical-center, medica-raphael.
На каждой странице — секция «Врачи клиники» (фильтр по `clinic_slug`).

### Направления (`napravleniya/`, 16 страниц)
allergologiya, gastroenterologiya, gematologiya, genetika, geriatriya, ginekologiya, kardiologiya, nevrologiya, ortopediya, urologiya, **dermatologiya, lor, proktologiya, stomatologiya, terapiya, endokrinologiya** (6 последних добавлены под импорт 127 врачей).
Онкология вынесена на отдельную страницу `onkologiya.html`.

Каждая страница направления подгружает карточки врачей через `doctors-loader.js` по точной связи `data-treatment-slug` (надёжная привязка через БД), с keyword-фолбэком.

### Профили врачей (`vrachi/`)
- **vrachi/template.html** — единый динамический шаблон профиля врача (`?id=...`), данные из API.
- Старые статические HTML-профили удалены — все профили теперь рендерятся из БД, что устраняет рассинхрон «врач в базе ↔ страница».

---

## API

### Tables REST API (`tables-server.js`, порт 8788)

| Метод | URL | Описание |
|---|---|---|
| GET | `tables/{table}?limit=N&sort=-field&search=text` | Список (поиск, сортировка, пагинация) |
| GET | `tables/{table}/{id}` | Запись по id |
| POST | `tables/{table}` | Создание (возвращает `{data:{...}}`) |
| PUT/PATCH | `tables/{table}/{id}` | Обновление |
| DELETE | `tables/{table}/{id}` | Удаление (204) |

Таблицы: `doctors`, `clinics`, `treatments`, `doctor_treatments`, `page_content`, `site_settings`, `form_submissions`, `seo_publish_logs`.

### Publish API (`publish-server.js`, порт 8787)

- `GET /health` — проверка сервиса
- `POST /admin/auth/*` — авторизация админки (HMAC-сессии)
- `POST /admin/publish/doctor/:id` — генерация `vrachi/{id}.html` + обновление `sitemap.xml`
- `POST /admin/publish/doctors/bulk` — bulk-публикация
- `POST /admin/publish/sitemap` — обновление sitemap
- POST `/admin/*` защищены `Bearer ADMIN_PUBLISH_TOKEN`

---

## Локальный запуск

```bash
cd extracted/server
npm install                 # better-sqlite3
node seed.js --reset        # засев БД (127 врачей, 16 направлений и т.д.)
node start.js               # поднимает tables (8788) + publish (8787) вместе
```

Затем раздать статику из `extracted/` любым статическим сервером (или через nginx по `server/nginx.conf.example`).

### Скрипты npm (`server/package.json`)
- `npm run seed` / `npm run seed:reset` — засев БД
- `npm run tables` — только tables API
- `npm run publish` — только publish-сервер
- `npm run start` — оба сервера

---

## Деплой (Ubuntu 24.04)

Полная инструкция — **`server/DEPLOY.md`** (10 шагов). Кратко:

1. Node 20 + build-essential + nginx
2. `git clone` проекта в `/var/www/taurus`
3. `npm install` + `node seed.js` в `extracted/server`
4. systemd-юнит `server/taurus.service.example` → автозапуск `start.js`
5. nginx-конфиг `server/nginx.conf.example` (домен `kliniki-izrailya.solomatin-marketing.ru`)
6. SSL через certbot (Let's Encrypt)

Backend-файлы лежат в `extracted/server/`:
`tables-server.js`, `publish-server.js`, `seed.js`, `start.js`, `package.json`,
`nginx.conf.example`, `taurus.service.example`, `DEPLOY.md`.

> `data.db` и `node_modules/` исключены из git (`.gitignore`) — БД создаётся на проде через `seed.js`.

---

## Технологии

HTML5, CSS3, JavaScript (ES6+), Node.js, SQLite (better-sqlite3), Nginx, systemd, Let's Encrypt.
Font Awesome 6.4, Google Fonts (Inter), JSON-LD Schema.org, Telegram Bot API, IntersectionObserver.

## Структура CSS / JS

| Файл | Назначение |
|---|---|
| `css/style.css` | Общие стили |
| `css/home.css` | Главная |
| `css/doctors-grid.css` | Сетка и карточки врачей, фильтр |
| `css/modal.css` | Модальная форма заявки |
| `js/main.js` | UI: FAQ, header scroll, mobile menu, анимации |
| `js/engine.js` | Движок: UTM, контент из API, Telegram, модалка |
| `js/doctors-loader.js` | Загрузка врачей для `napravleniya/*` (по `data-treatment-slug`) |
| `js/doctors-loader-inline.js` | Загрузка врачей для `onkologiya.html` и `kliniki/*` (slug/клиника) |
| `js/doctor-profile.js` | Динамический рендер профиля врача |
| `js/doctors-seed.js` | Сид-данные 127 врачей (импорт админкой / seed.js) |
| `js/admin.js` | Логика админ-панели (CRUD, импорт врачей, публикация) |

---

## Дальнейшее развитие

1. Реальные фото врачей через `photo_url`
2. Дополнительные направления при необходимости
3. Блог/статьи для пациентов
4. Мультиязычность (EN/HE)
5. Google Analytics / GTM
6. Кастомная страница 404
7. Lazy loading изображений
