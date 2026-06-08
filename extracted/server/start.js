/* ===== TAURUS MEDICAL — ЕДИНЫЙ ЗАПУСК =====
 * Поднимает оба сервиса в одном процессе:
 *   - tables API (SQLite)         на TABLES_PORT (по умолчанию 8788)
 *   - publish-server (SEO-страницы) на PUBLISH_PORT (по умолчанию 8787)
 *
 * Nginx проксирует:
 *   /tables/  -> :8788
 *   /admin/   -> :8787   (auth + публикация)
 *   /         -> статика (extracted/)
 *
 * ENV:
 *   TABLES_PORT=8788
 *   PUBLISH_PORT=8787
 *   DB_PATH=./data.db
 *   ADMIN_PUBLISH_TOKEN=...   (Bearer для POST /admin/* — задать в проде!)
 *   SITE_BASE_URL=https://kliniki-izrailya.solomatin-marketing.ru
 */
'use strict';

const TABLES_PORT = Number(process.env.TABLES_PORT || 8788);
const PUBLISH_PORT = Number(process.env.PUBLISH_PORT || 8787);

// 1) tables API — запускаем явно на TABLES_PORT
const tablesApi = require('./tables-server.js');
tablesApi.startServer(TABLES_PORT);

// 2) publish-server — экспортирует createPublishServer()
const { createPublishServer } = require('./publish-server.js');
// publish-server должен звать наш tables API
if (!process.env.TABLES_API_BASE) {
  process.env.TABLES_API_BASE = `http://localhost:${TABLES_PORT}/tables`;
}
const publishServer = createPublishServer();
publishServer.listen(PUBLISH_PORT, () => {
  console.log(`[publish] listening on :${PUBLISH_PORT}, TABLES_API_BASE=${process.env.TABLES_API_BASE}`);
});
