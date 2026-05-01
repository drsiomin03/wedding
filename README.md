# wedding

Свадебное приглашение с персональными ссылками.

## Короткие ссылки (без имён в URL)

- Основная страница приглашения: `index.html`
- Персонализация идёт по короткому коду в URL: `index.html?g=<code>`
- Коды и имена задаются в `guests.html` в массиве `GUEST_CODES`.

## Хранение RSVP в Supabase

1. Создайте проект Supabase.
2. В SQL Editor выполните файл `supabase-schema.sql`.
3. Откройте `rsvp-db.js` и подставьте:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Задеплойте Edge Function:
   - `supabase functions deploy rsvp --no-verify-jwt`
5. После этого:
   - `index.html` сохраняет ответ гостя (подтвердил/отказ) через Edge Function;
   - кнопка "Отменить подтверждение" удаляет запись через Edge Function;
   - `guests.html` показывает статус по каждому коду: "Подтверждено", "Отказ", "Без ответа".

## Безопасность (capability tokens)

- В `guests.html` у каждой записи есть `id` и `token`.
- В ссылку гостя передаются оба параметра: `?g=<id>&t=<token>`.
- В таблице `invite_tokens` хранится только SHA-256 хэш токена.
- Edge Function `rsvp` проверяет токен и только после этого меняет RSVP.
- Прямые `insert/update/delete` от анонимного клиента в `invites` отключены политиками.