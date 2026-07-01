# copy-editor_plugins

Каталог плагинов для [CopyEditor](https://github.com/hiterion-hann/copy-editor).

## Структура

- `catalog.json` — список плагинов
- `plugins/<id>/manifest.json` — описание плагина

## Добавление плагина

1. Создайте `plugins/my-plugin/manifest.json` (schemaVersion: 1)
2. Добавьте запись в `catalog.json`
3. Закоммитьте и запушьте в `main`

В приложении: **Настройки → Расширения → Открыть каталог → Обновить каталог**.
