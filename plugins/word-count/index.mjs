function countStats(text) {
  const trimmed = text.trim()
  if (!trimmed) {
    return { words: 0, chars: 0, charsNoSpaces: 0, paragraphs: 0, readingMin: 0 }
  }
  const words = trimmed.split(/\s+/).filter(Boolean).length
  const chars = trimmed.length
  const charsNoSpaces = trimmed.replace(/\s/g, '').length
  const paragraphs = trimmed.split(/\n{2,}/).filter((p) => p.trim()).length || 1
  const readingMin = Math.max(1, Math.ceil(words / 200))
  return { words, chars, charsNoSpaces, paragraphs, readingMin }
}

/** @type {(() => void) | null} */
let disposeWorkspace = null
/** @type {ReturnType<typeof setInterval> | null} */
let refreshTimer = null

/**
 * @param {HTMLElement} root
 * @param {import('@shared/external-plugin-api').ExternalPluginHostApi} api
 */
function mountWordCount(root, api) {
  root.style.cssText =
    'box-sizing:border-box;height:100%;padding:1.5rem 2rem;color:var(--color-foreground,#111);background:var(--color-background,#fff);font-family:Inter,system-ui,sans-serif;'

  const card = document.createElement('section')
  card.style.cssText =
    'max-width:32rem;margin:0 auto;border:1px solid var(--color-border,#e5e5e5);border-radius:0.75rem;padding:1.25rem;'

  const heading = document.createElement('h2')
  heading.style.cssText = 'margin:0 0 0.25rem;font-size:1.125rem;font-weight:600;'
  heading.textContent = 'Счётчик слов'

  const docLine = document.createElement('p')
  docLine.style.cssText = 'margin:0 0 1rem;font-size:0.8125rem;color:var(--color-muted-foreground,#71717a);'

  const grid = document.createElement('div')
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0.75rem;'

  const cells = [
    { key: 'words', label: 'Слов' },
    { key: 'chars', label: 'Символов' },
    { key: 'charsNoSpaces', label: 'Без пробелов' },
    { key: 'paragraphs', label: 'Абзацев' }
  ]

  const valueEls = {}
  for (const cell of cells) {
    const box = document.createElement('div')
    box.style.cssText =
      'border:1px solid var(--color-border,#ececec);border-radius:0.5rem;padding:0.75rem;'
    const label = document.createElement('div')
    label.style.cssText = 'font-size:0.7rem;color:var(--color-muted-foreground,#71717a);'
    label.textContent = cell.label
    const value = document.createElement('div')
    value.style.cssText = 'margin-top:0.25rem;font-size:1.25rem;font-weight:600;'
    value.textContent = '0'
    box.append(label, value)
    grid.appendChild(box)
    valueEls[cell.key] = value
  }

  const reading = document.createElement('p')
  reading.style.cssText = 'margin:1rem 0 0;font-size:0.8125rem;color:var(--color-muted-foreground,#71717a);'

  card.append(heading, docLine, grid, reading)
  root.appendChild(card)

  const render = () => {
    const title = api.vault.getActiveDocumentTitle()
    const text = api.vault.getActiveDocumentPlainText()
    const stats = countStats(text)
    docLine.textContent = title ? `Документ: ${title}` : 'Откройте документ в редакторе'
    for (const cell of cells) {
      valueEls[cell.key].textContent = String(stats[cell.key])
    }
    reading.textContent =
      stats.words > 0 ? `≈ ${stats.readingMin} мин чтения (200 слов/мин)` : 'Нет текста для подсчёта'
  }

  render()
  refreshTimer = setInterval(render, 800)

  return () => {
    if (refreshTimer) clearInterval(refreshTimer)
    refreshTimer = null
    root.replaceChildren()
  }
}

export function activate(api) {
  disposeWorkspace = api.ui.registerWorkspace({
    title: 'Счётчик слов',
    toolbarLabel: 'Слова',
    toolbarIcon: 'Aa',
    toolbarTitle: 'Статистика текущего документа',
    mount(root) {
      return mountWordCount(root, api)
    }
  })
  api.log('word-count activated')
}

export function deactivate() {
  disposeWorkspace?.()
  disposeWorkspace = null
}
