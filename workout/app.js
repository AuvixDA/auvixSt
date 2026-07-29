// Трекер тренировок — вся логика приложения. Данные хранятся только в localStorage.

const STORAGE_KEYS = {
  exercises: 'workout:exercises',
  entries: 'workout:entries',
  seeded: 'workout:seeded'
};

const CATEGORY_META = {
  strength: { label: 'Сила', color: '#ff8a3d', icon: '💪', unit: '1ПМ, кг' },
  endurance: { label: 'Выносливость', color: '#3ddc97', icon: '🫁', unit: 'мин/сессия' },
  speed: { label: 'Скорость', color: '#4fa3ff', icon: '⚡', unit: 'км/ч' }
};

const FIELD_CONFIG = {
  strength: ['weight', 'reps'],
  endurance: ['duration', 'distance'],
  speed: ['distance', 'duration']
};

const DEFAULT_EXERCISES = [
  { name: 'Жим лёжа', category: 'strength' },
  { name: 'Присед со штангой', category: 'strength' },
  { name: 'Становая тяга', category: 'strength' },
  { name: 'Жим ногами (тренажёр)', category: 'strength' },
  { name: 'Тяга верхнего блока', category: 'strength' },
  { name: 'Жим гантелей стоя', category: 'strength' },
  { name: 'Беговая дорожка (длительно)', category: 'endurance' },
  { name: 'Велотренажёр', category: 'endurance' },
  { name: 'Гребной тренажёр', category: 'endurance' },
  { name: 'Спринт на дорожке', category: 'speed' }
];

let state = {
  exercises: [],
  entries: [],
  tab: 'log',
  logDate: todayISO(),
  analyticsPeriod: 30,
  analyticsCategory: 'all'
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayISO() {
  return toISO(new Date());
}

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateHuman(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', weekday: 'short' });
}

function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISO(d);
}

// ---------- Persistence ----------

function loadState() {
  try {
    state.exercises = JSON.parse(localStorage.getItem(STORAGE_KEYS.exercises)) || [];
  } catch { state.exercises = []; }
  try {
    state.entries = JSON.parse(localStorage.getItem(STORAGE_KEYS.entries)) || [];
  } catch { state.entries = []; }

  if (!localStorage.getItem(STORAGE_KEYS.seeded) && state.exercises.length === 0) {
    state.exercises = DEFAULT_EXERCISES.map(e => ({ id: uid(), ...e }));
    localStorage.setItem(STORAGE_KEYS.seeded, '1');
    saveExercises();
  }
}

function saveExercises() {
  localStorage.setItem(STORAGE_KEYS.exercises, JSON.stringify(state.exercises));
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(state.entries));
}

function getExercise(id) {
  return state.exercises.find(e => e.id === id);
}

// ---------- Metrics ----------

function estimateOneRepMax(weight, reps) {
  if (!weight) return 0;
  if (!reps) return weight;
  return weight * (1 + reps / 30);
}

// Возвращает числовую метрику "результата" для одной тренировочной записи (entry)
// в зависимости от категории упражнения — то, что сравнивается во времени.
function computeEntryMetric(exercise, entry) {
  const sets = entry.sets || [];
  if (sets.length === 0) return null;

  if (exercise.category === 'strength') {
    const best = Math.max(...sets.map(s => estimateOneRepMax(s.weight, s.reps)));
    return best > 0 ? best : null;
  }
  if (exercise.category === 'endurance') {
    const total = sets.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
    return total > 0 ? total : null;
  }
  if (exercise.category === 'speed') {
    const speeds = sets
      .filter(s => s.distance > 0 && s.duration > 0)
      .map(s => (s.distance / (s.duration / 60))); // км / (мин/60) = км/ч
    if (speeds.length === 0) return null;
    return Math.max(...speeds);
  }
  return null;
}

function formatMetric(category, value) {
  if (value === null || value === undefined) return '—';
  if (category === 'strength') return `${value.toFixed(1)} кг`;
  if (category === 'endurance') return `${value.toFixed(0)} мин`;
  if (category === 'speed') return `${value.toFixed(1)} км/ч`;
  return value.toFixed(1);
}

// ---------- Rendering: shell ----------

function render() {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`panel-${state.tab}`).classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${state.tab}"]`).classList.add('active');

  if (state.tab === 'log') renderLog();
  if (state.tab === 'library') renderLibrary();
  if (state.tab === 'history') renderHistory();
  if (state.tab === 'analytics') renderAnalytics();
}

function switchTab(tab) {
  state.tab = tab;
  render();
}

// ---------- Tab: Log (Сегодня) ----------

function renderLog() {
  const panel = document.getElementById('panel-log');

  const exOptions = state.exercises
    .map(e => `<option value="${e.id}">${escapeHtml(e.name)} (${CATEGORY_META[e.category].label})</option>`)
    .join('');

  const dayEntries = state.entries.filter(e => e.date === state.logDate);

  panel.innerHTML = `
    <div class="card">
      <label class="field-label">Дата тренировки</label>
      <input type="date" id="log-date" value="${state.logDate}" max="${todayISO()}">
    </div>

    <div class="card">
      <label class="field-label">Упражнение / тренажёр</label>
      <select id="log-exercise">${exOptions || '<option disabled>Сначала добавьте упражнение</option>'}</select>
      <div id="log-fields" class="set-fields"></div>
      <button class="btn-primary" id="log-add-set">+ Добавить подход</button>
    </div>

    <div class="section-title">Сегодня записано</div>
    <div id="log-entries">${dayEntries.length ? dayEntries.map(renderEntryCard).join('') : '<p class="empty-hint">Пока пусто. Добавьте первый подход выше.</p>'}</div>
  `;

  document.getElementById('log-date').addEventListener('change', (e) => {
    state.logDate = e.target.value;
    renderLog();
  });

  const exSelect = document.getElementById('log-exercise');
  const renderFields = () => {
    const ex = getExercise(exSelect.value);
    document.getElementById('log-fields').innerHTML = ex ? setFieldsHtml(ex.category) : '';
  };
  if (exSelect) {
    exSelect.addEventListener('change', renderFields);
    renderFields();
  }

  const addBtn = document.getElementById('log-add-set');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const ex = getExercise(exSelect.value);
      if (!ex) return;
      const set = readSetFields(ex.category);
      if (!set) return;
      addSetToLog(ex.id, state.logDate, set);
    });
  }

  panel.querySelectorAll('[data-remove-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      removeSet(btn.dataset.entryId, Number(btn.dataset.setIndex));
    });
  });
}

function setFieldsHtml(category) {
  const fields = FIELD_CONFIG[category];
  const labels = {
    weight: 'Вес, кг', reps: 'Повторы', duration: 'Время, мин', distance: 'Дистанция, км'
  };
  return fields.map(f => `
    <div class="set-field">
      <label>${labels[f]}</label>
      <input type="number" inputmode="decimal" step="0.1" min="0" data-field="${f}" placeholder="${labels[f]}">
    </div>
  `).join('');
}

function readSetFields(category) {
  const fields = FIELD_CONFIG[category];
  const set = {};
  let hasValue = false;
  fields.forEach(f => {
    const input = document.querySelector(`#log-fields [data-field="${f}"]`);
    const val = input ? parseFloat(input.value) : NaN;
    set[f] = isNaN(val) ? 0 : val;
    if (!isNaN(val) && val > 0) hasValue = true;
    if (input) input.value = '';
  });
  if (!hasValue) return null;
  return set;
}

function addSetToLog(exerciseId, date, set) {
  let entry = state.entries.find(e => e.exerciseId === exerciseId && e.date === date);
  if (!entry) {
    entry = { id: uid(), exerciseId, date, sets: [] };
    state.entries.push(entry);
  }
  entry.sets.push(set);
  saveEntries();
  render();
}

function removeSet(entryId, setIndex) {
  const entry = state.entries.find(e => e.id === entryId);
  if (!entry) return;
  entry.sets.splice(setIndex, 1);
  if (entry.sets.length === 0) {
    state.entries = state.entries.filter(e => e.id !== entryId);
  }
  saveEntries();
  render();
}

function renderEntryCard(entry) {
  const ex = getExercise(entry.exerciseId);
  if (!ex) return '';
  const meta = CATEGORY_META[ex.category];
  const fields = FIELD_CONFIG[ex.category];
  const labels = { weight: 'кг', reps: 'повт', duration: 'мин', distance: 'км' };

  const setsHtml = entry.sets.map((s, i) => {
    const parts = fields.map(f => `${s[f]} ${labels[f]}`).join(' × ');
    return `<div class="set-row">
      <span>#${i + 1}: ${parts}</span>
      <button class="icon-btn" data-remove-set data-entry-id="${entry.id}" data-set-index="${i}" aria-label="Удалить подход">✕</button>
    </div>`;
  }).join('');

  return `
    <div class="card entry-card">
      <div class="entry-head">
        <span class="badge" style="background:${meta.color}22;color:${meta.color}">${meta.icon} ${meta.label}</span>
        <strong>${escapeHtml(ex.name)}</strong>
      </div>
      ${setsHtml}
    </div>
  `;
}

// ---------- Tab: Library (Упражнения) ----------

function renderLibrary() {
  const panel = document.getElementById('panel-library');
  const grouped = {};
  state.exercises.forEach(e => {
    grouped[e.category] = grouped[e.category] || [];
    grouped[e.category].push(e);
  });

  const listHtml = Object.keys(CATEGORY_META).map(cat => {
    const items = grouped[cat] || [];
    if (items.length === 0) return '';
    return `
      <div class="section-title">${CATEGORY_META[cat].icon} ${CATEGORY_META[cat].label}</div>
      ${items.map(e => `
        <div class="card row-card">
          <span>${escapeHtml(e.name)}</span>
          <button class="icon-btn" data-delete-ex="${e.id}" aria-label="Удалить">🗑</button>
        </div>
      `).join('')}
    `;
  }).join('');

  panel.innerHTML = `
    <div class="card">
      <label class="field-label">Новое упражнение / тренажёр</label>
      <input type="text" id="new-ex-name" placeholder="Например: Жим лёжа">
      <label class="field-label">Тип (для аналитики)</label>
      <select id="new-ex-category">
        ${Object.entries(CATEGORY_META).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
      </select>
      <button class="btn-primary" id="add-exercise">+ Добавить</button>
    </div>
    ${listHtml || '<p class="empty-hint">Список пуст.</p>'}
  `;

  document.getElementById('add-exercise').addEventListener('click', () => {
    const nameInput = document.getElementById('new-ex-name');
    const category = document.getElementById('new-ex-category').value;
    const name = nameInput.value.trim();
    if (!name) return;
    state.exercises.push({ id: uid(), name, category });
    saveExercises();
    renderLibrary();
  });

  panel.querySelectorAll('[data-delete-ex]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.deleteEx;
      if (!confirm('Удалить упражнение? История тренировок по нему тоже будет удалена.')) return;
      state.exercises = state.exercises.filter(e => e.id !== id);
      state.entries = state.entries.filter(e => e.exerciseId !== id);
      saveExercises();
      saveEntries();
      renderLibrary();
    });
  });
}

// ---------- Tab: History (История) ----------

function renderHistory() {
  const panel = document.getElementById('panel-history');
  const byDate = {};
  state.entries.forEach(e => {
    byDate[e.date] = byDate[e.date] || [];
    byDate[e.date].push(e);
  });
  const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  if (dates.length === 0) {
    panel.innerHTML = '<p class="empty-hint">История пуста — начните с вкладки «Сегодня».</p>';
    return;
  }

  panel.innerHTML = dates.map(date => `
    <div class="section-title">${formatDateHuman(date)}</div>
    ${byDate[date].map(renderEntryCard).join('')}
  `).join('');

  panel.querySelectorAll('[data-remove-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      removeSet(btn.dataset.entryId, Number(btn.dataset.setIndex));
      renderHistory();
    });
  });
}

// ---------- Tab: Analytics (Аналитика) ----------

function renderAnalytics() {
  const panel = document.getElementById('panel-analytics');

  panel.innerHTML = `
    <div class="card">
      <label class="field-label">Период</label>
      <div class="period-buttons">
        ${[7, 30, 60, 90].map(p => `<button class="chip ${state.analyticsPeriod === p ? 'chip-active' : ''}" data-period="${p}">${p} дн.</button>`).join('')}
      </div>
    </div>
    <div id="summary-cards" class="summary-grid"></div>
    <div class="section-title">Прогресс по упражнениям</div>
    <div id="exercise-charts"></div>
  `;

  panel.querySelectorAll('[data-period]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.analyticsPeriod = Number(btn.dataset.period);
      renderAnalytics();
    });
  });

  const startDate = daysAgoISO(state.analyticsPeriod);
  const endDate = todayISO();

  renderSummaryCards(startDate, endDate);
  renderExerciseCharts(startDate, endDate);
}

function trendForExercise(exercise, startDate, endDate) {
  const entries = state.entries
    .filter(e => e.exerciseId === exercise.id && e.date >= startDate && e.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const points = entries
    .map(e => ({ date: e.date, value: computeEntryMetric(exercise, e) }))
    .filter(p => p.value !== null);

  if (points.length === 0) return null;

  const chunk = Math.max(1, Math.floor(points.length / 3));
  const startVals = points.slice(0, chunk).map(p => p.value);
  const endVals = points.slice(-chunk).map(p => p.value);
  const startAvg = average(startVals);
  const endAvg = average(endVals);
  const pctChange = startAvg > 0 ? ((endAvg - startAvg) / startAvg) * 100 : (endAvg > 0 ? 100 : 0);

  return { points, startAvg, endAvg, pctChange, hasEnough: points.length >= 2 };
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function renderSummaryCards(startDate, endDate) {
  const container = document.getElementById('summary-cards');
  const cards = Object.entries(CATEGORY_META).map(([cat, meta]) => {
    const exercises = state.exercises.filter(e => e.category === cat);
    const trends = exercises
      .map(ex => trendForExercise(ex, startDate, endDate))
      .filter(t => t && t.hasEnough);

    if (trends.length === 0) {
      return `
        <div class="card summary-card">
          <div class="summary-icon">${meta.icon}</div>
          <div class="summary-label">${meta.label}</div>
          <div class="summary-value muted">нет данных</div>
        </div>
      `;
    }

    const avgPct = average(trends.map(t => t.pctChange));
    const sign = avgPct >= 0 ? '+' : '';
    const colorClass = avgPct >= 0 ? 'up' : 'down';
    return `
      <div class="card summary-card">
        <div class="summary-icon">${meta.icon}</div>
        <div class="summary-label">${meta.label}</div>
        <div class="summary-value ${colorClass}">${sign}${avgPct.toFixed(1)}%</div>
      </div>
    `;
  }).join('');
  container.innerHTML = cards;
}

function renderExerciseCharts(startDate, endDate) {
  const container = document.getElementById('exercise-charts');
  const cards = state.exercises.map(ex => {
    const trend = trendForExercise(ex, startDate, endDate);
    const meta = CATEGORY_META[ex.category];
    if (!trend) {
      return `
        <div class="card exercise-chart-card">
          <div class="entry-head">
            <span class="badge" style="background:${meta.color}22;color:${meta.color}">${meta.icon} ${meta.label}</span>
            <strong>${escapeHtml(ex.name)}</strong>
          </div>
          <p class="empty-hint">Нет записей за этот период</p>
        </div>
      `;
    }

    const svg = renderLineChartSVG(trend.points, meta.color);
    const pctBadge = trend.hasEnough
      ? `<span class="pct-badge ${trend.pctChange >= 0 ? 'up' : 'down'}">${trend.pctChange >= 0 ? '▲' : '▼'} ${Math.abs(trend.pctChange).toFixed(1)}%</span>`
      : `<span class="pct-badge muted">мало данных</span>`;

    return `
      <div class="card exercise-chart-card">
        <div class="entry-head">
          <span class="badge" style="background:${meta.color}22;color:${meta.color}">${meta.icon} ${meta.label}</span>
          <strong>${escapeHtml(ex.name)}</strong>
          ${pctBadge}
        </div>
        ${svg}
        <div class="chart-footer">
          <span>${formatDateHuman(trend.points[0].date)}: ${formatMetric(ex.category, trend.startAvg)}</span>
          <span>${formatDateHuman(trend.points[trend.points.length - 1].date)}: ${formatMetric(ex.category, trend.endAvg)}</span>
        </div>
      </div>
    `;
  }).join('');
  container.innerHTML = cards || '<p class="empty-hint">Добавьте упражнения на вкладке «Упражнения».</p>';
}

function renderLineChartSVG(points, color) {
  const width = 300;
  const height = 100;
  const padding = 10;

  if (points.length === 1) {
    return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg">
      <circle cx="${width / 2}" cy="${height / 2}" r="4" fill="${color}"></circle>
    </svg>`;
  }

  const values = points.map(p => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * (width - padding * 2);
    const y = height - padding - ((p.value - min) / range) * (height - padding * 2);
    return [x, y];
  });

  const path = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L${coords[coords.length - 1][0].toFixed(1)},${height - padding} L${coords[0][0].toFixed(1)},${height - padding} Z`;

  const dots = coords.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5" fill="${color}"></circle>`).join('');

  return `<svg viewBox="0 0 ${width} ${height}" class="chart-svg">
    <path d="${areaPath}" fill="${color}22" stroke="none"></path>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2"></path>
    ${dots}
  </svg>`;
}

// ---------- Utils ----------

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Init ----------

function init() {
  loadState();
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);
