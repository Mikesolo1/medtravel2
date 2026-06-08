# Taurus Medical Experts — Лечение в Израиле

Медицинский портал для организации лечения в Израиле. Подбор врача под диагноз, клиники, направления, консультации.

## Текущий статус проекта

### ✅ Реализованные функции

#### Основные страницы
- **index.html** — главная страница с hero-секцией, направлениями, преимуществами, процессом, второе мнение, FAQ
- **o-nas.html** — страница «О нас»
- **kliniki-izrailya.html** — каталог клиник Израиля (7 клиник: государственные и частные)
- **otdeleniya.html** — направления и отделения (с ссылками на все специализированные страницы)
- **vrachi.html** — каталог врачей с фильтрацией по 11 специальностям (17+ карточек)
- **onkologiya.html** — подробная страница по онкологии
- **patsientam.html** — информация для пациентов
- **otzyvy.html** — отзывы пациентов
- **kontakty.html** — контактная форма

#### Индивидуальные страницы клиник (`kliniki/`)
- ikhilov-sourasky.html — МЦ Сураски (Ихилов)
- sheba-tel-hashomer.html — МЦ Шиба
- rabin-beilinson.html — МЦ Рабина (Бейлинсон)
- wolfson.html — МЦ Вольфсон
- assuta.html — Ассута
- herzliya-medical-center.html — Герцлия Медикал Центр
- medica-raphael.html — Медика (Рафаэль)

#### Индивидуальные страницы врачей (`vrachi/`)
- **41 гибридная страница профилей врачей** (stefanski.html, ron.html, inbar.html, merimsky.html, banai.html, raanani.html, ram.html и др.)
  - Статический HTML для SEO + динамическое обновление из API через `js/doctor-profile.js`
  - При изменении данных врача в админке — обновляется фото, описание, теги, специальность на странице автоматически
- **vrachi/template.html** — полностью динамическая страница профиля врача (загружает данные из API по `?id=...`)
- Каждый профиль включает: JSON-LD разметку, специальность, клинику, языки, направления практики, теги, CTA-кнопки

#### Страницы направлений (`napravleniya/`)
- **allergologiya.html** — Аллергология и иммунология
- **gastroenterologiya.html** — Гастроэнтерология и гепатология
- **gematologiya.html** — Гематология и онкогематология
- **genetika.html** — Генетика и онкогенетика
- **ginekologiya.html** — Гинекология и репродуктология
- **geriatriya.html** — Гериатрия и психогериатрия
- **kardiologiya.html** — Кардиология и кардиохирургия
- **nevrologiya.html** — Неврология и нейрохирургия
- **ortopediya.html** — Ортопедия и травматология
- **urologiya.html** — Урология

Каждая страница направления динамически загружает карточки врачей через `doctors-loader.js` с фильтрацией по специальности. Подключён `engine.js` для динамического обновления контента (H1, meta, hero text) из админки.

#### Админ-панель
- **admin.html** — панель управления (пароль: taurus2024)
  - Управление контентом страниц (SEO: meta title, description, H1, hero text)
  - **Редактирование направлений** — 10 страниц napravleniya доступны для редактирования контента
  - CRUD врачей (с полем ID/slug для формирования URL, превью фото)
  - CRUD клиник
  - Настройки Telegram-бота и контактных данных
  - Просмотр заявок с UTM-метками
  - Автосоздание записей настроек и страниц направлений при отсутствии

#### Формы и интеграции
- Модальная форма заявки (консультация, второе мнение, обратный звонок)
- UTM-параметры: захват из URL, хранение в sessionStorage, передача с заявкой
- Отправка заявок в Telegram через Bot API
- Сохранение заявок в таблицу `form_submissions`

#### База данных (RESTful API)
- **Таблица `doctors`** — 50 записей врачей по 14 полям
- **Таблица `clinics`** — 7 записей клиник по 15 полям
- **Таблица `site_settings`** — настройки сайта (Telegram, контакты, пароль)
- **Таблица `page_content`** — динамический контент страниц
- **Таблица `form_submissions`** — заявки с UTM-метками

### Врачи в базе (50 записей, все уникальные)

| Специальность | Врачи |
|---|---|
| Онкология | Проф. Инбар, Проф. Меримский, Проф. Стефански, Проф. Рон |
| Кардиология/Кардиохирургия | Проф. Банай, Проф. Раанани, Д-р Лишанский |
| Нейрохирургия | Проф. Рам, Проф. Константини |
| Ортопедия | Проф. Салай, Д-р Калганов |
| Урология | Проф. Мацкин, Д-р Надо |
| Гастроэнтерология/Гепатология | Проф. Гальперин, Проф. Исраэлит, Д-р Рабинович, Д-р Скапа, Д-р Восько, Д-р Лахав, Д-р Мигдаль, Проф. Раиф, Проф. Глок, Проф. Бен-Ари, Проф. Коникофф, Д-р Карлебах, Проф. Орен, Проф. Шиболет |
| Гинекология/Репродуктология | Проф. Грисаро, Проф. Ярон, Д-р Островски, Д-р Ратан, Проф. Левин И., Проф. Ласков, Проф. Маслович |
| Аллергология/Иммунология | Д-р Бен Ор, Д-р Теплицкий, Д-р Хагин, Проф. Хендзель |
| Гематология/Онкогематология | Д-р Гур, Проф. Исраэли Ш., Д-р Тавор, Проф. Напарстек, Д-р Рыбаковская, Д-р Левин Д., Проф. Саломон, Д-р Нойман |
| Генетика/Онкогенетика | Д-р Коэн, Д-р Рейнштейн, Проф. Фридман |
| Гериатрия | Д-р Кемельман |

## Функциональные URI

| Путь | Описание |
|---|---|
| `/index.html` | Главная страница |
| `/vrachi.html` | Каталог врачей с фильтрами по специальностям |
| `/vrachi/{slug}.html` | Статический профиль врача (42 страницы) |
| `/vrachi/template.html?id={doctor_id}` | Профиль врача (динамический шаблон) |
| `/kliniki-izrailya.html` | Каталог клиник |
| `/kliniki/{slug}.html` | Страница клиники |
| `/otdeleniya.html` | Все направления |
| `/napravleniya/{direction}.html` | Страница направления с динамической подгрузкой врачей |
| `/onkologiya.html` | Онкология (подробно) |
| `/kontakty.html` | Контакты и формы |
| `/admin.html` | Админ-панель |

## API Endpoints

| Метод | URL | Описание |
|---|---|---|
| GET | `tables/doctors?limit=100` | Список всех врачей |
| GET | `tables/doctors/{id}` | Данные конкретного врача |
| POST | `tables/doctors` | Создание нового врача |
| PUT | `tables/doctors/{id}` | Обновление врача |
| DELETE | `tables/doctors/{id}` | Удаление врача |
| GET | `tables/clinics?limit=100` | Список всех клиник |
| GET | `tables/clinics/{id}` | Данные конкретной клиники |
| POST | `tables/clinics` | Создание клиники |
| PUT | `tables/clinics/{id}` | Обновление клиники |
| DELETE | `tables/clinics/{id}` | Удаление клиники |
| GET | `tables/site_settings?limit=100` | Все настройки |
| PATCH | `tables/site_settings/{id}` | Обновление настройки |
| POST | `tables/site_settings` | Создание настройки |
| GET | `tables/page_content?search={slug}` | Контент страницы по slug |
| PATCH | `tables/page_content/{id}` | Обновление контента страницы |
| POST | `tables/form_submissions` | Сохранение заявки |
| GET | `tables/form_submissions?limit=100&sort=-created_at` | Список заявок |

### Publish API (server-side SEO generation)

Для устранения разрыва «врач создан в БД, но нет постоянной SEO-страницы», добавлен сервер публикации:

- `GET /health` — проверка доступности publish-сервиса
- `POST /admin/publish/doctor/:id` — генерация `vrachi/{id}.html` + обновление `sitemap.xml`
- `POST /admin/publish/doctor/:id?mode=dry-run` — dry-run без записи файла
- `POST /admin/publish/doctors/bulk` — bulk-публикация массива врачей
- `POST /admin/publish/sitemap` — массовое обновление sitemap по списку slug

Локальный запуск:

```bash
cd extracted
PORT=8787 TABLES_API_BASE="http://localhost:8788/tables" node server/publish-server.js
```

Опционально можно защитить endpoint токеном:

```bash
ADMIN_PUBLISH_TOKEN="your-secret" node server/publish-server.js
```

В `admin.html` publish интеграция работает в 2 режимах:
- **Primary:** серверный `POST /admin/publish/...`
- **Fallback:** локальная генерация и скачивание html-файла (если backend недоступен)

## Технологии

- HTML5, CSS3, JavaScript (ES6+)
- Font Awesome 6.4 (иконки)
- Google Fonts (Inter)
- RESTful Table API для хранения данных
- Telegram Bot API для уведомлений
- Responsive design (mobile-first)
- JSON-LD Schema.org разметка (врачи, клиники)
- IntersectionObserver для анимаций при скролле
- Динамическая загрузка контента (fetch API)

## Архитектура CSS

| Файл | Назначение | Используется |
|---|---|---|
| `css/style.css` | Общие стили: переменные, reset, header, nav, content sections, footer, responsive | Все страницы |
| `css/home.css` | Стили главной: hero, benefits, directions, process, FAQ, CTA | index.html |
| `css/doctors-grid.css` | Сетка и карточки врачей, кнопки фильтра | vrachi.html, napravleniya/*.html |
| `css/modal.css` | Модальная форма заявки | Все страницы (через engine.js) |

## Архитектура JavaScript

| Файл | Назначение | Используется |
|---|---|---|
| `js/main.js` | UI: FAQ-аккордеон, header scroll, mobile menu, smooth scroll, IntersectionObserver | Все страницы |
| `js/engine.js` | Движок: UTM-трекинг, загрузка контента из API, Telegram, модальная форма, CTA-кнопки | Все страницы |
| `js/doctors-loader.js` | Динамическая загрузка карточек врачей по специальности из API | napravleniya/*.html |
| `js/doctors-loader-inline.js` | Загрузка врачей по clinic_slug или specialty для страниц на корневом и kliniki/ уровне | onkologiya.html, kliniki/*.html |
| `js/doctors-photo-enhancer.js` | Подгружает фото врачей из API и обновляет аватары на статических карточках | vrachi.html |
| `js/doctor-profile.js` | Гибридный enhancer: подгружает данные врача из API и обновляет DOM (фото, описание, теги) | vrachi/*.html (41 страница) |

## Структура файлов

```
/
├── index.html              — Главная
├── o-nas.html              — О нас
├── kliniki-izrailya.html   — Каталог клиник
├── otdeleniya.html         — Направления
├── vrachi.html             — Каталог врачей (фильтры)
├── onkologiya.html         — Онкология
├── patsientam.html         — Пациентам
├── otzyvy.html             — Отзывы
├── kontakty.html           — Контакты
├── admin.html              — Админ-панель
├── README.md
├── css/
│   ├── style.css           — Общие стили (466 строк)
│   ├── home.css            — Стили главной (735 строк)
│   ├── modal.css           — Стили модалки (170 строк)
│   └── doctors-grid.css    — Сетка врачей + фильтр (180 строк)
├── js/
│   ├── main.js             — UI-интеракции (115 строк)
│   ├── engine.js           — Движок сайта (382 строки)
│   ├── doctors-loader.js   — Загрузчик врачей для napravleniya (72 строки)
│   ├── doctors-loader-inline.js — Загрузчик врачей для onkologiya/kliniki (90 строк)
│   ├── doctors-photo-enhancer.js — Фото-enhancer для карточек на vrachi.html (45 строк)
│   └── doctor-profile.js   — Гибридный enhancer профилей (130 строк)
├── kliniki/
│   ├── ikhilov-sourasky.html
│   ├── sheba-tel-hashomer.html
│   ├── rabin-beilinson.html
│   ├── wolfson.html
│   ├── assuta.html
│   ├── herzliya-medical-center.html
│   └── medica-raphael.html
├── vrachi/                 — 42 статических профиля + шаблон
│   ├── template.html
│   ├── stefanski.html
│   ├── stefanski-p.html
│   ├── ron.html
│   ├── inbar.html
│   ├── merimsky.html
│   ├── ... (38 других)
│   └── napartsek.html
├── napravleniya/           — 10 страниц направлений
│   ├── allergologiya.html
│   ├── gastroenterologiya.html
│   ├── gematologiya.html
│   ├── genetika.html
│   ├── ginekologiya.html
│   ├── geriatriya.html
│   ├── kardiologiya.html
│   ├── nevrologiya.html
│   ├── ortopediya.html
│   └── urologiya.html
└── patsientam/
    ├── prieezd-v-izrail.html
    ├── programma-obsledovaniya.html
    └── soputstvuyushchie-uslugi.html
```

## Выполненные задачи рефакторинга

1. ✅ Исправлена ссылка на профиль Стефански (указывает на правильную статическую страницу)
2. ✅ Проверены ссылки в doctors-loader.js — все врачи ссылаются на `../vrachi/{id}.html`, кнопка «Записаться» ведёт на `../kontakty.html`
3. ✅ Добавлено поле ID/slug в форму добавления врача в админ-панели (паттерн `[a-z0-9\-]+`)
4. ✅ `saveSettings` корректно создаёт новые записи настроек, если они отсутствуют (POST fallback)
5. ✅ Аудит межстраничных ссылок: все 42 профиля врачей → `../kontakty.html`, все 10 направлений → `../kontakty.html`
6. ✅ CSS рефакторинг: удалены дубликаты `.doctor-card`, перенесены inline-стили фильтра из vrachi.html в `css/doctors-grid.css`
7. ✅ JS рефакторинг: исправлена ссылка на несуществующую анимацию `fadeInUp` в фильтре врачей
8. ✅ **Связь админки с профилями врачей**: создан `js/doctor-profile.js` — гибридный enhancer, подгружающий данные из API поверх статического HTML
9. ✅ **Фото врача**: превью в админке при вводе URL, автоматическое отображение фото на детальной странице из API
10. ✅ **Редактирование направлений**: 10 страниц napravleniya добавлены в PAGE_NAMES админки, подключён engine.js, автосоздание записей page_content
11. ✅ **Врачи на странице онкологии**: добавлена динамическая секция «Наши онкологи» с загрузкой из API через `doctors-loader-inline.js`
12. ✅ **Врачи привязаны к клиникам**: на всех 7 страницах `kliniki/*.html` добавлена секция «Врачи клиники» с фильтрацией по `clinic_slug`
13. ✅ **Фото на превью-карточках**: создан `doctors-photo-enhancer.js` для vrachi.html, а `doctors-loader.js` и `doctors-loader-inline.js` корректно отображают `photo_url` или заглушку

## Рекомендации по дальнейшей разработке

1. **Фотографии врачей** — добавить реальные фото через поле `photo_url` в админ-панели
2. ~~**SEO-оптимизация** — добавить sitemap.xml, robots.txt, Open Graph теги~~ ✅ Выполнено
3. **Дополнительные направления** — Эндокринология, Педиатрия, Реабилитация, Дерматология
4. **Блог/Статьи** — раздел с полезными материалами для пациентов
5. **Мультиязычность** — английская и ивритская версии сайта
6. **Google Analytics / GTM** — подключение аналитики и тегов конверсий
7. **Страница 404** — кастомная страница для несуществующих URL
8. **Lazy loading** — отложенная загрузка изображений для ускорения
9. **Service Worker** — оффлайн-кеширование для мобильных устройств
10. **A/B тестирование** — вариации CTA-кнопок и форм для оптимизации конверсий
