# Деплой Taurus Medical на VPS (Ubuntu 24.04, SQLite)

Домен: **kliniki-izrailya.solomatin-marketing.ru**
Стек: статика + Node.js (tables API + publish-server) + SQLite + Nginx.

---

## 0. Что где работает

| Компонент | Порт | Назначение |
|-----------|------|-----------|
| Nginx | 80/443 | раздаёт статику + проксирует API |
| tables API (`tables-server.js`) | 8788 | БД (SQLite): врачи, клиники, страницы и т.д. |
| publish-server (`publish-server.js`) | 8787 | auth админки + генерация SEO-страниц врачей |

Запускаются вместе через `start.js` под systemd.

---

## 1. Подготовка сервера

```bash
# Обновление
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential nginx git

# Проверка
node -v   # должно быть v20.x
```

> `build-essential` нужен для сборки `better-sqlite3` (нативный модуль).

---

## 2. Код на сервер

```bash
sudo mkdir -p /var/www/taurus
sudo chown -R $USER:$USER /var/www/taurus
cd /var/www/taurus

# Клонируем репозиторий (ветка main после мёрджа PR)
git clone https://github.com/Mikesolo1/medtravel2.git .
# Рабочие файлы сайта лежат в extracted/
ls extracted/
```

---

## 3. Установка зависимостей сервера

```bash
cd /var/www/taurus/extracted/server
npm install --omit=dev    # поставит better-sqlite3
```

---

## 4. Инициализация базы (сид)

```bash
cd /var/www/taurus/extracted/server

# Задайте свой пароль администратора!
ADMIN_PASSWORD='ВАШ_СИЛЬНЫЙ_ПАРОЛЬ' DB_PATH=./data.db node seed.js
```

Создаст `data.db` с данными:
- 29 страниц (page_content)
- 7 клиник, 10 направлений
- 33 врача + 33 связи врач↔направление
- настройки сайта + хэш пароля админки

> Повторный `node seed.js` **не затирает** данные (обновляет справочники, врачей).
> Полный сброс: `node seed.js --reset` (УДАЛИТ всё и засеет заново).

---

## 5. Пользователь и systemd

```bash
# Системный пользователь без shell
sudo adduser --system --group taurus
sudo chown -R taurus:taurus /var/www/taurus

# Юнит
sudo cp /var/www/taurus/extracted/server/taurus.service.example /etc/systemd/system/taurus.service
sudo nano /etc/systemd/system/taurus.service
#   -> замените ADMIN_PUBLISH_TOKEN и ADMIN_AUTH_SECRET своими:
#      openssl rand -hex 24   (для токена)
#      openssl rand -hex 32   (для секрета)

sudo systemctl daemon-reload
sudo systemctl enable --now taurus
sudo systemctl status taurus          # active (running)
curl localhost:8788/health            # {"ok":true,...}
```

---

## 6. Nginx

```bash
sudo cp /var/www/taurus/extracted/server/nginx.conf.example /etc/nginx/sites-available/taurus
sudo ln -s /etc/nginx/sites-available/taurus /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t        # syntax ok
sudo systemctl reload nginx
```

Проверка по HTTP: `http://kliniki-izrailya.solomatin-marketing.ru` — сайт открывается.

---

## 7. SSL (Let's Encrypt)

> Сначала настройте DNS: A-запись `kliniki-izrailya.solomatin-marketing.ru` → IP вашего VPS.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d kliniki-izrailya.solomatin-marketing.ru
# certbot сам пропишет 443 и редирект с 80
```

Автообновление сертификата уже настроено systemd-таймером certbot.

---

## 8. Проверка

- `https://.../` — главная
- `https://.../vrachi.html` — список врачей (грузится из БД)
- `https://.../napravleniya/allergologiya.html` — 4 врача-аллерголога
- `https://.../kliniki/ikhilov-sourasky.html` — 11 врачей Ихилов
- `https://.../admin.html` — вход по паролю из шага 4

---

## 9. Обновление сайта (деплой новой версии)

```bash
cd /var/www/taurus
git pull origin main
cd extracted/server
npm install --omit=dev          # если менялись зависимости
sudo systemctl restart taurus   # перезапуск API
sudo systemctl reload nginx     # если менялась статика — не обязательно
```

> `data.db` при `git pull` не трогается (она в .gitignore). Данные сохраняются.

---

## 10. Бэкап базы

```bash
# SQLite — это один файл. Бэкап:
cp /var/www/taurus/extracted/server/data.db ~/taurus-backup-$(date +%F).db

# Рекомендуется cron раз в сутки:
# 0 3 * * * cp /var/www/taurus/extracted/server/data.db /home/backups/taurus-$(date +\%F).db
```

---

## Частые проблемы

- **`better-sqlite3` не ставится** → не хватает `build-essential`. `sudo apt install build-essential`, затем `npm install`.
- **502 на /tables/** → сервис не запущен. `sudo systemctl status taurus`, `journalctl -u taurus -f`.
- **Врачи не грузятся** → проверьте `curl localhost:8788/tables/doctors?limit=1`. Если пусто — выполните сид (шаг 4).
- **admin.html: «доступ запрещён»** → проверьте `ADMIN_PUBLISH_TOKEN`/`ADMIN_AUTH_SECRET` в юните и пароль из сида.
- **Права на запись** → `data.db`, `vrachi/`, `sitemap.xml` должны принадлежать `taurus` (publish-server пишет туда).
