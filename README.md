# Каталог плагинов CopyEditor

Репозиторий внешних плагинов для CopyEditor.

## Структура

```
catalog.json
plugins/
  task-calendar/
    manifest.json
    index.mjs
    styles.css
```

## Плагины

| ID | Описание |
|----|----------|
| `task-calendar` | Месячный календарь с задачами по дням, привязка к документам vault |
| `word-count` | Пример минимального плагина |

## Подключение

1. Настройки → Расширения → **Открыть каталог**
2. URL: `https://github.com/hiterion-hann/copy-editor_plugins`
3. **Обновить каталог** → установить плагин → включить

Данные `task-calendar` хранятся в `vault/.copyeditor/plugin-data/task-calendar.json`.

## manifest.json

- `entry` — точка входа (`index.mjs`)
- `files` — файлы для копирования при установке
- `features.workspaceView` / `features.toolbar` — UI в приложении

## API плагина

```js
export async function activate(api) {
  api.ui.registerWorkspace({
    title: 'Заголовок',
    toolbarLabel: 'Кнопка',
    mount(root) { /* DOM */ }
  })
}
```
