/** @typedef {{ id: string; date: string; title: string; done: boolean; docPath?: string; createdAt: string }} Task */
/** @typedef {{ schemaVersion: number; tasks: Task[] }} CalendarData */

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]
const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

/** @type {(() => void) | null} */
let disposeWorkspace = null
/** @type {CalendarData | null} */
let data = null
/** @type {import('@shared/external-plugin-api').ExternalPluginHostApi | null} */
let apiRef = null
/** @type {ReturnType<typeof setTimeout> | null} */
let saveTimer = null

function todayKey() {
  const d = new Date()
  return formatDateKey(d)
}

function formatDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

function defaultData() {
  return { schemaVersion: 1, tasks: [] }
}

function normalizeData(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tasks)) return defaultData()
  return {
    schemaVersion: 1,
    tasks: raw.tasks
      .filter((t) => t && typeof t.id === 'string' && typeof t.date === 'string' && typeof t.title === 'string')
      .map((t) => ({
        id: t.id,
        date: t.date,
        title: t.title.trim(),
        done: Boolean(t.done),
        docPath: typeof t.docPath === 'string' ? t.docPath : undefined,
        createdAt: typeof t.createdAt === 'string' ? t.createdAt : new Date().toISOString()
      }))
  }
}

function scheduleSave() {
  if (!apiRef || !data) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void apiRef.storage.save(data)
  }, 400)
}

function ensureStyles() {
  if (document.querySelector('link[data-task-calendar-styles]')) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'plugin://task-calendar/styles.css'
  link.setAttribute('data-task-calendar-styles', '1')
  document.head.appendChild(link)
}

/**
 * @param {HTMLElement} root
 * @param {import('@shared/external-plugin-api').ExternalPluginHostApi} api
 */
function mountCalendar(root, api) {
  ensureStyles()

  const state = {
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    selectedDate: todayKey()
  }

  const shell = document.createElement('div')
  shell.className = 'tc-root'
  root.appendChild(shell)

  const layout = document.createElement('div')
  layout.className = 'tc-layout'
  shell.appendChild(layout)

  const calendarCard = document.createElement('section')
  calendarCard.className = 'tc-card'
  const sideCard = document.createElement('section')
  sideCard.className = 'tc-card'
  layout.append(calendarCard, sideCard)

  function tasksForDate(dateKey) {
    return (data?.tasks ?? []).filter((t) => t.date === dateKey)
  }

  function renderCalendar() {
    calendarCard.replaceChildren()

    const header = document.createElement('div')
    header.className = 'tc-header'

    const title = document.createElement('h2')
    title.className = 'tc-title'
    title.textContent = `${MONTHS_RU[state.viewMonth]} ${state.viewYear}`

    const nav = document.createElement('div')
    nav.className = 'tc-nav'

    const prev = document.createElement('button')
    prev.className = 'tc-btn'
    prev.type = 'button'
    prev.textContent = '←'
    prev.onclick = () => {
      if (state.viewMonth === 0) {
        state.viewMonth = 11
        state.viewYear -= 1
      } else {
        state.viewMonth -= 1
      }
      renderCalendar()
    }

    const todayBtn = document.createElement('button')
    todayBtn.className = 'tc-btn'
    todayBtn.type = 'button'
    todayBtn.textContent = 'Сегодня'
    todayBtn.onclick = () => {
      const now = new Date()
      state.viewYear = now.getFullYear()
      state.viewMonth = now.getMonth()
      state.selectedDate = todayKey()
      renderCalendar()
      renderSide()
    }

    const next = document.createElement('button')
    next.className = 'tc-btn'
    next.type = 'button'
    next.textContent = '→'
    next.onclick = () => {
      if (state.viewMonth === 11) {
        state.viewMonth = 0
        state.viewYear += 1
      } else {
        state.viewMonth += 1
      }
      renderCalendar()
    }

    nav.append(prev, todayBtn, next)
    header.append(title, nav)
    calendarCard.appendChild(header)

    const weekdays = document.createElement('div')
    weekdays.className = 'tc-weekdays'
    for (const label of WEEKDAYS_RU) {
      const cell = document.createElement('div')
      cell.className = 'tc-weekday'
      cell.textContent = label
      weekdays.appendChild(cell)
    }
    calendarCard.appendChild(weekdays)

    const grid = document.createElement('div')
    grid.className = 'tc-grid'

    const first = new Date(state.viewYear, state.viewMonth, 1)
    const startOffset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(state.viewYear, state.viewMonth + 1, 0).getDate()
    const prevMonthDays = new Date(state.viewYear, state.viewMonth, 0).getDate()
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7

    for (let i = 0; i < totalCells; i += 1) {
      let dayNum
      let dateKey
      let muted = false

      if (i < startOffset) {
        dayNum = prevMonthDays - startOffset + i + 1
        dateKey = formatDateKey(new Date(state.viewYear, state.viewMonth - 1, dayNum))
        muted = true
      } else if (i >= startOffset + daysInMonth) {
        dayNum = i - startOffset - daysInMonth + 1
        dateKey = formatDateKey(new Date(state.viewYear, state.viewMonth + 1, dayNum))
        muted = true
      } else {
        dayNum = i - startOffset + 1
        dateKey = formatDateKey(new Date(state.viewYear, state.viewMonth, dayNum))
      }

      const tasks = tasksForDate(dateKey)
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'tc-day'
      if (muted) btn.classList.add('tc-day-muted')
      if (dateKey === state.selectedDate) btn.classList.add('tc-day-selected')
      if (dateKey === todayKey()) btn.classList.add('tc-day-today')

      const num = document.createElement('span')
      num.className = 'tc-day-num'
      num.textContent = String(dayNum)
      btn.appendChild(num)

      if (tasks.length) {
        const dots = document.createElement('div')
        dots.className = 'tc-day-dots'
        for (const task of tasks.slice(0, 4)) {
          const dot = document.createElement('span')
          dot.className = task.done ? 'tc-dot tc-dot-done' : 'tc-dot'
          dots.appendChild(dot)
        }
        btn.appendChild(dots)
      }

      btn.onclick = () => {
        state.selectedDate = dateKey
        if (muted) {
          const picked = parseDateKey(dateKey)
          state.viewYear = picked.getFullYear()
          state.viewMonth = picked.getMonth()
        }
        renderCalendar()
        renderSide()
      }

      grid.appendChild(btn)
    }

    calendarCard.appendChild(grid)
  }

  function renderSide() {
    sideCard.replaceChildren()

    const selected = parseDateKey(state.selectedDate)
    const heading = document.createElement('h3')
    heading.className = 'tc-side-title'
    heading.textContent = `Задачи на ${selected.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })}`
    sideCard.appendChild(heading)

    const form = document.createElement('div')
    form.className = 'tc-form'

    const input = document.createElement('input')
    input.className = 'tc-input'
    input.placeholder = 'Новая задача…'
    input.maxLength = 200

    const docSelect = document.createElement('select')
    docSelect.className = 'tc-select'
    const emptyOpt = document.createElement('option')
    emptyOpt.value = ''
    emptyOpt.textContent = 'Без документа'
    docSelect.appendChild(emptyOpt)
    for (const doc of api.listDocuments()) {
      const opt = document.createElement('option')
      opt.value = doc.path
      opt.textContent = doc.title
      docSelect.appendChild(opt)
    }

    const addBtn = document.createElement('button')
    addBtn.className = 'tc-btn tc-btn-primary'
    addBtn.type = 'button'
    addBtn.textContent = 'Добавить'
    addBtn.onclick = () => {
      const title = input.value.trim()
      if (!title || !data) return
      data.tasks.push({
        id: createId('task'),
        date: state.selectedDate,
        title,
        done: false,
        docPath: docSelect.value || undefined,
        createdAt: new Date().toISOString()
      })
      input.value = ''
      scheduleSave()
      renderCalendar()
      renderSide()
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addBtn.click()
    })

    form.append(input, docSelect, addBtn)
    sideCard.appendChild(form)

    const list = document.createElement('div')
    list.className = 'tc-task-list'
    const dayTasks = tasksForDate(state.selectedDate)

    if (!dayTasks.length) {
      const empty = document.createElement('p')
      empty.className = 'tc-empty'
      empty.textContent = 'Нет задач на этот день.'
      list.appendChild(empty)
    } else {
      for (const task of dayTasks) {
        const row = document.createElement('div')
        row.className = task.done ? 'tc-task tc-task-done' : 'tc-task'

        const check = document.createElement('input')
        check.type = 'checkbox'
        check.checked = task.done
        check.onchange = () => {
          task.done = check.checked
          scheduleSave()
          renderCalendar()
          renderSide()
        }

        const body = document.createElement('div')
        const titleEl = document.createElement('div')
        titleEl.className = 'tc-task-title'
        titleEl.textContent = task.title
        body.appendChild(titleEl)

        if (task.docPath) {
          const meta = document.createElement('div')
          meta.className = 'tc-task-meta'
          const link = document.createElement('button')
          link.type = 'button'
          link.className = 'tc-link'
          const doc = api.listDocuments().find((d) => d.path === task.docPath)
          link.textContent = doc ? `📄 ${doc.title}` : '📄 Открыть документ'
          link.onclick = () => {
            void api.openDocument(task.docPath)
          }
          meta.appendChild(link)
          body.appendChild(meta)
        }

        const del = document.createElement('button')
        del.className = 'tc-btn'
        del.type = 'button'
        del.textContent = '×'
        del.onclick = () => {
          if (!data) return
          data.tasks = data.tasks.filter((t) => t.id !== task.id)
          scheduleSave()
          renderCalendar()
          renderSide()
        }

        row.append(check, body, del)
        list.appendChild(row)
      }
    }

    sideCard.appendChild(list)
  }

  renderCalendar()
  renderSide()

  return () => {
    if (saveTimer) clearTimeout(saveTimer)
    root.replaceChildren()
  }
}

export async function activate(api) {
  apiRef = api
  const loaded = await api.storage.load()
  data = normalizeData(loaded)

  disposeWorkspace = api.ui.registerWorkspace({
    title: 'Календарь задач',
    toolbarLabel: 'Календарь',
    toolbarIcon: '📅',
    toolbarTitle: 'Открыть календарь задач',
    mount(root) {
      return mountCalendar(root, api)
    }
  })

  api.log('task-calendar activated')
}

export function deactivate() {
  if (saveTimer) clearTimeout(saveTimer)
  disposeWorkspace?.()
  disposeWorkspace = null
  apiRef = null
  data = null
}
