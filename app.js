/* ═══════════════════════════════════════════════════════════
   PUSHABIT — Full-Featured Habit Tracker SPA
   ═══════════════════════════════════════════════════════════ */
(() => {
  'use strict';

  // ── Constants ────────────────────────────────────────────
  const STORAGE_KEY = 'pushabit_data';
  const LONG_PRESS_MS = 500;
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const HEATMAP_WEEKS = 20;
  const CATEGORY_EMOJIS = { Health: '❤️', Productivity: '⚡', Mindfulness: '🧘', Learning: '📚', Fitness: '💪', 'Self-Care': '🌿' };

  const QUOTES = [
    // Anime
    ["If you don't take risks, you can't create a future.", "Monkey D. Luffy"],
    ["A lesson without pain is meaningless.", "Edward Elric"],
    ["If you don't like your destiny, don't accept it.", "Naruto Uzumaki"],
    ["Power comes in response to a need, not a desire.", "Goku"],
    ["I'll leave tomorrow's problems to tomorrow's me.", "Saitama"],
    ["Push through the pain. Giving up hurts more.", "Vegeta"],
    ["Being weak is nothing to be ashamed of. Staying weak is.", "Fuegoleon"],
    ["A dropout will beat a genius through hard work.", "Rock Lee"],
    ["When you give up, that's when the game is over.", "Mitsuyoshi Anzai"],
    ["No matter how deep the night, it always turns to day.", "Brook"],
    ["Do not fear. Just move forward.", "All Might"],
    ["Fear is not evil. It tells you what your weakness is.", "Gildarts Clive"],
    // Movies & TV
    ["It does not do to dwell on dreams and forget to live.", "Albus Dumbledore"],
    ["After all this time? Always.", "Severus Snape"],
    ["Why do we fall? So we can learn to pick ourselves up.", "Batman"],
    ["With great power comes great responsibility.", "Spider-Man"],
    ["I am Iron Man.", "Tony Stark"],
    ["I can do this all day.", "Steve Rogers"],
    ["It's not about how much we lost. It's about how much we have left.", "Tony Stark"],
    ["In this world, nothing worth having comes easy.", "Dr. Bob Kelso"],
    ["The only thing we have to fear is fear itself... and spiders.", "Michael Scott"],
    ["Happiness can be found in the darkest of times, if one only remembers to turn on the light.", "Albus Dumbledore"],
    ["Hope is a good thing, maybe the best of things.", "Andy Dufresne"],
    ["Just keep swimming.", "Dory"],
    ["To infinity and beyond!", "Buzz Lightyear"],
    ["Our fate lives within us. You only have to be brave enough to see it.", "Merida"],
    ["Life is not a spectator sport. If watching is all you're gonna do, you're gonna watch your life go by without you.", "Laverne"],
    // Books & Games
    ["Even the smallest person can change the course of the future.", "Galadriel"],
    ["All we have to decide is what to do with the time that is given us.", "Gandalf"],
    ["It is only with the heart that one can see rightly.", "The Little Prince"],
    ["Not all those who wander are lost.", "J.R.R. Tolkien"],
    ["A man chooses. A slave obeys.", "Andrew Ryan"],
    ["The right man in the wrong place can make all the difference.", "G-Man"],
    ["War. War never changes.", "The Narrator (Fallout)"],
    ["It's dangerous to go alone! Take this.", "Old Man (Zelda)"],
    ["Stand amongst the ashes of a trillion dead souls, and ask if honor matters.", "Javik"],
    ["Would you kindly keep pushing your habits?", "Atlas"],
    ["Stay determined.", "Undertale"],
    ["We all make choices, but in the end our choices make us.", "Andrew Ryan"],
    ["The cake is a lie, but your progress is real.", "Portal"],
    ["Boy, listen close. Do not be sorry. Be better.", "Kratos"],
    ["No gods or kings. Only man.", "Andrew Ryan"],
  ];

  // ── State ────────────────────────────────────────────────
  let state = loadState();
  let currentView = 'dashboard';
  let currentFilter = 'all';
  let selectedHabitId = null;
  let editingHabitId = null;
  let detailCalMonth = new Date().getMonth();
  let detailCalYear = new Date().getFullYear();
  let calViewMonth = new Date().getMonth();
  let calViewYear = new Date().getFullYear();
  let calViewSelectedDay = null;
  let focusIndex = 0;
  let longPressTimer = null;
  let nudgeTimer = null;
  let toastTimeout = null;
  let confirmCallback = null;

  // ── DOM ──────────────────────────────────────────────────
  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // ── Utilities ────────────────────────────────────────────
  function genId() { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
  function todayKey() { return dateKey(new Date()); }
  function dateKey(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function daysAgo(n) { const d = new Date(); d.setDate(d.getDate()-n); return dateKey(d); }
  function parseKey(k) { const p = k.split('-'); return new Date(+p[0], +p[1]-1, +p[2]); }
  function getGreeting() { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; }
  function formatDate(d) { return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }); }
  function formatMonthYear(m, y) { return new Date(y, m).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function isHabitScheduledToday(habit) {
    const dow = new Date().getDay();
    if (!habit.frequency || habit.frequency === 'daily') return true;
    if (habit.frequency === 'weekdays') return dow >= 1 && dow <= 5;
    if (habit.frequency === 'weekends') return dow === 0 || dow === 6;
    if (habit.frequency === 'custom' && habit.customDays) return habit.customDays.includes(dow);
    return true;
  }

  function isHabitScheduledOn(habit, date) {
    const dow = date.getDay();
    if (!habit.frequency || habit.frequency === 'daily') return true;
    if (habit.frequency === 'weekdays') return dow >= 1 && dow <= 5;
    if (habit.frequency === 'weekends') return dow === 0 || dow === 6;
    if (habit.frequency === 'custom' && habit.customDays) return habit.customDays.includes(dow);
    return true;
  }

  // ── Persistence ──────────────────────────────────────────
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          habits: p.habits || [],
          archived: p.archived || [],
          completions: p.completions || {},
          notes: p.notes || {},
          theme: p.theme || 'light',
          userName: p.userName || '',
          userEmail: p.userEmail || '',
          onboarded: p.onboarded || false,
          nudgesEnabled: p.nudgesEnabled !== false,
          nudgeInterval: p.nudgeInterval || 45,
          streakGoal: p.streakGoal || 30,
          userPfp: p.userPfp || '',
        };
      }
    } catch(e) { console.warn('Load error:', e); }
    return { habits: [], archived: [], completions: {}, notes: {}, theme: 'light', userName: '', userEmail: '', onboarded: false, nudgesEnabled: true, nudgeInterval: 45, streakGoal: 30, userPfp: '' };
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e) { console.warn('Save error:', e); }
  }

  // ── Theme ────────────────────────────────────────────────
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    state.theme = t;
    saveState();
    // Update toggle
    const toggle = $('#themeToggle');
    if (toggle) toggle.classList.toggle('active', t === 'dark');
  }

  // ── Navigation ───────────────────────────────────────────
  function navigate(view) {
    currentView = view;
    $$('.view').forEach(v => v.style.display = 'none');

    const bottomNav = $('#bottomNav');
    const viewMap = {
      onboarding: 'viewOnboarding',
      dashboard: 'viewDashboard',
      habitDetail: 'viewHabitDetail',
      calendar: 'viewCalendar',
      analytics: 'viewAnalytics',
      settings: 'viewSettings',
    };

    const el = $(`#${viewMap[view]}`);
    if (el) {
      el.style.display = 'block';
      el.style.animation = 'none';
      el.offsetHeight; // reflow
      el.style.animation = '';
    }

    // Show/hide nav
    if (view === 'onboarding') {
      bottomNav.style.display = 'none';
    } else {
      bottomNav.style.display = 'flex';
    }

    // Active nav item
    $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.nav === view));

    // Scroll top
    window.scrollTo(0, 0);

    // Render view-specific content
    if (view === 'dashboard') renderDashboard();
    else if (view === 'analytics') renderAnalytics();
    else if (view === 'calendar') renderCalendarView();
    else if (view === 'settings') renderSettings();
    else if (view === 'habitDetail') renderHabitDetail();
  }

  // ── Onboarding ───────────────────────────────────────────
  function setupOnboarding() {
    // Starter chip toggle
    $$('.starter-chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('selected'));
    });

    $('#onboardSubmit').addEventListener('click', () => {
      const name = $('#onboardName').value.trim();
      const email = $('#onboardEmail').value.trim();

      if (!name) { showToast('Please enter your name'); $('#onboardName').focus(); return; }
      if (!email) { showToast('Please enter your email'); $('#onboardEmail').focus(); return; }
      if (!email.includes('@')) { showToast('Please enter a valid email'); $('#onboardEmail').focus(); return; }

      const goal = parseInt($('#onboardGoal').value) || 30;
      state.userName = name;
      state.userEmail = email;
      state.streakGoal = goal;
      state.onboarded = true;
      state._v2 = true;

      // Add selected starter habits
      const selected = $$('.starter-chip.selected');
      selected.forEach(chip => {
        state.habits.push({
          id: genId(),
          name: chip.dataset.habit,
          emoji: chip.dataset.emoji || '🎯',
          category: chip.dataset.cat || 'Health',
          frequency: 'daily',
          customDays: [],
          reminder: '',
          createdAt: Date.now(),
        });
      });

      saveState();
      navigate('dashboard');
      showToast(`Welcome, ${name}!`);
    });
  }

  // ── Dashboard ────────────────────────────────────────────
  function renderDashboard() {
    updateGreeting();
    renderStreak();
    renderMiniRing();
    renderQuickStats();
    renderHabits();
    renderMiniHeatmap();
    renderCorrelations($('#correlationsList'), 2);
  }

  function updateGreeting() {
    const g = $('#greeting');
    const d = $('#dateLabel');
    const avatarEl = $('#avatarBtn');
    const q = $('#animeQuote');
    if (g) g.textContent = `${getGreeting()}, ${state.userName || 'Friend'}`;
    if (d) d.textContent = formatDate(new Date());
    if (avatarEl) {
      if (state.userPfp) {
        avatarEl.innerHTML = `<img src="${state.userPfp}" alt="Profile" class="avatar-img"/>`;
      } else {
        avatarEl.innerHTML = `<span id="avatarLetter">${(state.userName || 'A')[0].toUpperCase()}</span>`;
      }
    }
    if (q) {
      const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      q.textContent = `\u201C${quote[0]}\u201D \u2014 ${quote[1]}`;
    }
  }

  function renderStreak() {
    const streak = calculateStreak();
    const el = $('#streakNumber');
    if (el) animateNumber(el, streak);
    const goalLabel = $('#streakGoalLabel');
    if (goalLabel) goalLabel.textContent = `/ ${state.streakGoal} day goal`;
  }

  function renderMiniRing() {
    const rate = getCompletionRate();
    const circumference = 2 * Math.PI * 16;
    const offset = circumference - (rate / 100) * circumference;
    const ring = $('#miniRing');
    const text = $('#miniRingText');
    if (ring) requestAnimationFrame(() => ring.style.strokeDashoffset = offset);
    if (text) text.textContent = `${rate}%`;
  }

  function renderQuickStats() {
    const totalDays = calculateDaysActive();
    const bestStreak = calculateBestStreak();
    const weeklyAvg = calculateWeeklyAvg();
    animateNumber($('#qsTotalDays'), totalDays);
    animateNumber($('#qsBestStreak'), bestStreak);
    animateNumber($('#qsWeeklyAvg'), weeklyAvg);
  }

  // ── Habits List ──────────────────────────────────────────
  function renderHabits() {
    const list = $('#habitsList');
    if (!list) return;

    const today = todayKey();
    const todayComps = state.completions[today] || [];
    let habits = state.habits.filter(h => isHabitScheduledToday(h));

    // Filter
    if (currentFilter === 'pending') habits = habits.filter(h => !todayComps.includes(h.id));
    else if (currentFilter === 'completed') habits = habits.filter(h => todayComps.includes(h.id));
    else if (currentFilter.startsWith('cat:')) {
      const cat = currentFilter.slice(4);
      habits = habits.filter(h => h.category === cat);
    }

    if (habits.length === 0) {
      list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">○</div><div class="empty-state-text">${
        state.habits.length === 0 ? 'No habits yet. Tap + to add one.' : 'No habits match this filter.'
      }</div></div>`;
      return;
    }

    list.innerHTML = habits.map((habit, i) => {
      const done = todayComps.includes(habit.id);
      return `
        <div class="habit-card ${done ? 'completed' : ''}" data-id="${habit.id}" style="animation-delay:${i*0.04}s">
          <span class="habit-emoji">${habit.emoji || '🎯'}</span>
          <div class="habit-checkbox">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <div class="habit-info">
            <div class="habit-name">${escapeHtml(habit.name)}</div>
            <div class="habit-meta-line">
              <span class="habit-cat-tag">${habit.category || 'General'}</span>
              <span class="habit-time">${done ? 'Done' : habit.frequency === 'daily' ? 'Daily' : habit.frequency || 'Daily'}</span>
            </div>
          </div>
          <div class="habit-actions">
            <button class="habit-action-btn detail-btn" data-detail="${habit.id}" title="Details">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');

    // Bind events
    list.querySelectorAll('.habit-card').forEach(card => {
      const id = card.dataset.id;
      let pressStart = 0;

      const completeAction = () => { toggleHabit(id); };

      // Click on checkbox or card
      card.addEventListener('click', e => {
        if (e.target.closest('.detail-btn')) {
          selectedHabitId = e.target.closest('.detail-btn').dataset.detail;
          navigate('habitDetail');
          return;
        }
        if (e.target.closest('.habit-actions')) return;
        completeAction();
      });

      // Long-press mobile
      card.addEventListener('touchstart', e => {
        if (e.target.closest('.habit-actions')) return;
        pressStart = Date.now();
        card.classList.add('pressing');
        longPressTimer = setTimeout(() => {
          completeAction();
          card.classList.remove('pressing');
          navigator.vibrate && navigator.vibrate(30);
        }, LONG_PRESS_MS);
      }, { passive: true });

      card.addEventListener('touchend', () => { clearTimeout(longPressTimer); card.classList.remove('pressing'); });
      card.addEventListener('touchmove', () => { clearTimeout(longPressTimer); card.classList.remove('pressing'); });
    });
  }

  function toggleHabit(id) {
    const today = todayKey();
    if (!state.completions[today]) state.completions[today] = [];
    const arr = state.completions[today];
    const idx = arr.indexOf(id);
    if (idx === -1) { arr.push(id); showToast('Habit completed ✓'); }
    else { arr.splice(idx, 1); showToast('Unchecked'); }
    saveState();
    renderDashboard();
  }

  // ── Add / Edit Habit Modal ───────────────────────────────
  function openHabitModal(editId) {
    editingHabitId = editId || null;
    const overlay = $('#modalOverlay');
    const title = $('#modalTitle');
    const input = $('#habitInput');
    const confirmBtn = $('#modalConfirm');

    if (editId) {
      const h = state.habits.find(x => x.id === editId);
      if (!h) return;
      title.textContent = 'Edit Habit';
      confirmBtn.textContent = 'Save Changes';
      input.value = h.name;
      // Select category
      $$('#categoryChips .cat-chip').forEach(c => c.classList.toggle('selected', c.dataset.cat === h.category));
      // Select frequency
      $$('#freqOptions .freq-chip').forEach(c => c.classList.toggle('selected', c.dataset.freq === (h.frequency || 'daily')));
      $('#customDays').style.display = (h.frequency === 'custom') ? 'flex' : 'none';
      if (h.customDays) $$('#customDays .day-chip').forEach(c => c.classList.toggle('selected', h.customDays.includes(+c.dataset.day)));
      // Emoji
      $$('#emojiPicker .emoji-btn').forEach(c => c.classList.toggle('selected', c.dataset.emoji === h.emoji));
      // Reminder
      $('#habitReminder').value = h.reminder || '';
    } else {
      title.textContent = 'New Habit';
      confirmBtn.textContent = 'Add Habit';
      input.value = '';
      $$('#categoryChips .cat-chip').forEach((c, i) => c.classList.toggle('selected', i === 0));
      $$('#freqOptions .freq-chip').forEach((c, i) => c.classList.toggle('selected', i === 0));
      $('#customDays').style.display = 'none';
      $$('#emojiPicker .emoji-btn').forEach((c, i) => c.classList.toggle('selected', i === 0));
      $('#habitReminder').value = '';
    }

    overlay.classList.add('active');
    setTimeout(() => input.focus(), 300);
  }

  function closeHabitModal() {
    $('#modalOverlay').classList.remove('active');
    editingHabitId = null;
  }

  function confirmHabitModal() {
    const name = $('#habitInput').value.trim();
    if (!name) { showToast('Enter a habit name'); return; }

    const category = $$('#categoryChips .cat-chip.selected')[0]?.dataset.cat || 'Health';
    const frequency = $$('#freqOptions .freq-chip.selected')[0]?.dataset.freq || 'daily';
    const customDays = frequency === 'custom'
      ? [...$$('#customDays .day-chip.selected')].map(c => +c.dataset.day)
      : [];
    const emoji = $$('#emojiPicker .emoji-btn.selected')[0]?.dataset.emoji || '🎯';
    const reminder = $('#habitReminder').value || '';

    if (editingHabitId) {
      const h = state.habits.find(x => x.id === editingHabitId);
      if (h) {
        h.name = name; h.category = category; h.frequency = frequency;
        h.customDays = customDays; h.emoji = emoji; h.reminder = reminder;
        showToast('Habit updated');
      }
    } else {
      state.habits.push({
        id: genId(), name, emoji, category, frequency, customDays, reminder, createdAt: Date.now(),
      });
      showToast(`"${name}" added`);
    }

    saveState();
    closeHabitModal();
    if (currentView === 'dashboard') renderDashboard();
    else if (currentView === 'habitDetail') renderHabitDetail();
  }

  // ── Habit Detail View ────────────────────────────────────
  function renderHabitDetail() {
    const h = state.habits.find(x => x.id === selectedHabitId);
    if (!h) { navigate('dashboard'); return; }

    $('#detailTitle').textContent = h.name;
    $('#detailEmoji').textContent = h.emoji || '🎯';
    $('#detailName').textContent = h.name;
    $('#detailCategory').textContent = h.category || 'General';
    $('#detailFrequency').textContent = h.frequency === 'custom'
      ? (h.customDays || []).map(d => DAY_NAMES[d].slice(0,2)).join(', ')
      : (h.frequency || 'Daily');

    // Stats
    const hStreak = calcHabitStreak(h);
    const hBest = calcHabitBestStreak(h);
    const hTotal = calcHabitTotal(h);
    const hRate = calcHabitRate(h);
    $('#detailStreak').textContent = hStreak;
    $('#detailBest').textContent = hBest;
    $('#detailTotal').textContent = hTotal;
    $('#detailRate').textContent = hRate + '%';

    renderDetailCalendar(h);
    renderNotes(h);
  }

  function renderDetailCalendar(habit) {
    const monthLabel = $('#calMonth');
    monthLabel.textContent = formatMonthYear(detailCalMonth, detailCalYear);

    const grid = $('#calendarGrid');
    const firstDay = new Date(detailCalYear, detailCalMonth, 1).getDay();
    const daysInMonth = new Date(detailCalYear, detailCalMonth + 1, 0).getDate();
    const today = new Date();

    let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d =>
      `<div class="cal-header-cell">${d.slice(0,1)}</div>`
    ).join('');

    for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(detailCalYear, detailCalMonth, day);
      const key = dateKey(d);
      const comps = state.completions[key] || [];
      const isDone = comps.includes(habit.id);
      const isToday = key === todayKey();
      const isFuture = d > today;
      const cls = [
        'cal-cell',
        isDone ? 'has-completion' : '',
        isToday ? 'today' : '',
        isFuture ? 'future' : '',
      ].filter(Boolean).join(' ');
      html += `<div class="${cls}">${day}</div>`;
    }

    grid.innerHTML = html;
  }

  function renderNotes(habit) {
    const list = $('#notesList');
    const habitNotes = (state.notes[habit.id] || []).slice().reverse();

    if (habitNotes.length === 0) {
      list.innerHTML = '<div class="empty-small">No notes yet.</div>';
      return;
    }

    list.innerHTML = habitNotes.map((n, i) => `
      <div class="note-item">
        <button class="note-delete" data-note-idx="${habitNotes.length - 1 - i}">×</button>
        <div class="note-date">${new Date(n.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <div class="note-text">${escapeHtml(n.text)}</div>
      </div>
    `).join('');

    list.querySelectorAll('.note-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.noteIdx;
        state.notes[habit.id].splice(idx, 1);
        saveState();
        renderNotes(habit);
      });
    });
  }

  // ── Calendar View ────────────────────────────────────────
  function renderCalendarView() {
    const monthLabel = $('#calViewMonth');
    monthLabel.textContent = formatMonthYear(calViewMonth, calViewYear);

    const grid = $('#calViewGrid');
    const firstDay = new Date(calViewYear, calViewMonth, 1).getDay();
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    const today = new Date();

    let html = ['S','M','T','W','T','F','S'].map(d =>
      `<div class="cal-header-cell">${d}</div>`
    ).join('');

    for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(calViewYear, calViewMonth, day);
      const key = dateKey(d);
      const comps = state.completions[key] || [];
      const scheduled = state.habits.filter(h => isHabitScheduledOn(h, d));
      const allDone = scheduled.length > 0 && scheduled.every(h => comps.includes(h.id));
      const someDone = comps.length > 0 && !allDone;
      const isToday = key === todayKey();
      const isFuture = d > today;
      const cls = [
        'cal-cell',
        allDone ? 'has-completion' : someDone ? 'partial' : '',
        isToday ? 'today' : '',
        isFuture ? 'future' : '',
      ].filter(Boolean).join(' ');
      html += `<div class="${cls}" data-calday="${key}">${day}</div>`;
    }

    grid.innerHTML = html;

    // Select today by default
    if (!calViewSelectedDay) calViewSelectedDay = todayKey();
    renderCalendarDayDetail(calViewSelectedDay);

    grid.querySelectorAll('.cal-cell[data-calday]').forEach(cell => {
      cell.addEventListener('click', () => {
        calViewSelectedDay = cell.dataset.calday;
        renderCalendarDayDetail(calViewSelectedDay);
      });
    });
  }

  function renderCalendarDayDetail(dayKey) {
    const d = parseKey(dayKey);
    $('#calDayTitle').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const comps = state.completions[dayKey] || [];
    const scheduled = state.habits.filter(h => isHabitScheduledOn(h, d));
    const container = $('#calDayHabits');

    if (scheduled.length === 0) {
      container.innerHTML = '<div class="empty-small">No habits scheduled.</div>';
      return;
    }

    container.innerHTML = scheduled.map(h => {
      const done = comps.includes(h.id);
      return `
        <div class="cal-habit-item">
          <span class="cal-habit-emoji">${h.emoji || '🎯'}</span>
          <span class="cal-habit-name">${escapeHtml(h.name)}</span>
          <div class="cal-habit-status ${done ? 'done' : ''}">
            ${done ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </div>
        </div>`;
    }).join('');
  }

  // ── Analytics View ───────────────────────────────────────
  function renderAnalytics() {
    renderAnalyticsRing();
    renderBarChart();
    renderFullHeatmap();
    renderHabitBreakdown();
    renderMilestone();
    renderCorrelations($('#fullCorrelations'), 5);
  }

  function renderAnalyticsRing() {
    const rate = getWeeklyCompletionRate();
    const circumference = 2 * Math.PI * 50;
    const offset = circumference - (rate / 100) * circumference;
    const ring = $('#analyticsRing');
    const val = $('#analyticsRingValue');
    if (ring) requestAnimationFrame(() => ring.style.strokeDashoffset = offset);
    if (val) val.textContent = `${rate}%`;
  }

  function renderBarChart() {
    const chart = $('#barChart');
    if (!chart) return;
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = dateKey(d);
      const count = (state.completions[key] || []).length;
      days.push({ name: DAY_NAMES[d.getDay()], count, isToday: key === todayKey() });
    }
    const max = Math.max(...days.map(d => d.count), 1);
    chart.innerHTML = days.map(d => `
      <div class="bar-day ${d.isToday ? 'today' : ''}">
        <span class="bar-count">${d.count || ''}</span>
        <div class="bar-fill-wrapper"><div class="bar-fill-inner" style="height:${(d.count/max)*100}%"></div></div>
        <span class="bar-label">${d.name}</span>
      </div>`).join('');
  }

  function renderFullHeatmap() {
    const labels = $('#heatmapLabels');
    const grid = $('#heatmapGrid');
    if (!labels || !grid) return;

    labels.innerHTML = ['Mon','','Wed','','Fri','',''].map(l =>
      `<div class="heatmap-day-label">${l}</div>`).join('');

    const today = new Date();
    const todayDow = today.getDay();
    const startOffset = HEATMAP_WEEKS * 7 - 1 + todayDow;
    let html = '';
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      html += '<div class="heatmap-col">';
      for (let dow = 0; dow < 7; dow++) {
        const back = startOffset - (w * 7 + dow);
        const d = new Date(today); d.setDate(d.getDate() - back);
        const key = dateKey(d);
        const count = (state.completions[key] || []).length;
        const level = d > today ? 0 : heatLevel(count);
        html += `<div class="heatmap-cell level-${level}" title="${key}: ${count}"></div>`;
      }
      html += '</div>';
    }
    grid.innerHTML = html;
  }

  function renderMiniHeatmap() {
    const container = $('#miniHeatmap');
    if (!container) return;
    const today = new Date();
    const todayDow = today.getDay();
    const weeks = 12;
    const startOffset = weeks * 7 - 1 + todayDow;
    let html = '';
    for (let w = 0; w < weeks; w++) {
      html += '<div class="mini-hm-col">';
      for (let dow = 0; dow < 7; dow++) {
        const back = startOffset - (w * 7 + dow);
        const d = new Date(today); d.setDate(d.getDate() - back);
        const key = dateKey(d);
        const count = (state.completions[key] || []).length;
        const level = d > today ? 0 : heatLevel(count);
        html += `<div class="mini-hm-cell level-${level}"></div>`;
      }
      html += '</div>';
    }
    container.innerHTML = html;
  }

  function heatLevel(c) { return c === 0 ? 0 : c === 1 ? 1 : c <= 2 ? 2 : c <= 3 ? 3 : 4; }

  function renderHabitBreakdown() {
    const container = $('#habitBreakdown');
    if (!container) return;

    if (state.habits.length === 0) {
      container.innerHTML = '<div class="empty-small">No habits to analyze.</div>';
      return;
    }

    const data = state.habits.map(h => {
      const rate = calcHabitRate(h);
      return { name: h.name, emoji: h.emoji || '🎯', rate };
    }).sort((a, b) => b.rate - a.rate);

    container.innerHTML = data.map(d => `
      <div class="breakdown-row">
        <span class="breakdown-emoji">${d.emoji}</span>
        <div class="breakdown-info">
          <div class="breakdown-name">${escapeHtml(d.name)}</div>
          <div class="breakdown-bar-bg"><div class="breakdown-bar-fill" style="width:${d.rate}%"></div></div>
        </div>
        <span class="breakdown-pct">${d.rate}%</span>
      </div>`).join('');
  }

  function renderMilestone() { animateNumber($('#milestoneNumber'), calculateDaysActive()); }

  function renderCorrelations(container, limit) {
    if (!container) return;
    if (state.habits.length < 2) {
      container.innerHTML = '<div class="no-correlations">Add at least 2 habits to see correlations.</div>';
      return;
    }

    const pairs = [];
    const ids = state.habits.map(h => h.id);
    const names = {}; state.habits.forEach(h => names[h.id] = h.name);

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        let both = 0, aCount = 0;
        Object.values(state.completions).forEach(c => {
          if (c.includes(ids[i])) { aCount++; if (c.includes(ids[j])) both++; }
        });
        if (aCount > 3) {
          const pct = Math.round((both / aCount) * 100);
          if (pct >= 40) pairs.push({ a: names[ids[i]], b: names[ids[j]], pct });
        }
      }
    }

    pairs.sort((a, b) => b.pct - a.pct);
    const top = pairs.slice(0, limit);

    if (top.length === 0) {
      container.innerHTML = '<div class="no-correlations">Keep tracking to discover patterns.</div>';
      return;
    }

    container.innerHTML = top.map(p => `
      <div class="correlation-item">
        <span class="correlation-percent">${p.pct}%</span>
        <span class="correlation-text">When you do <strong>${escapeHtml(p.a)}</strong>, you also do <strong>${escapeHtml(p.b)}</strong>.</span>
      </div>`).join('');
  }

  // ── Settings ─────────────────────────────────────────────
  function renderSettings() {
    $('#settingsName').value = state.userName;
    $('#settingsEmail').value = state.userEmail;
    $('#settingsGoal').value = state.streakGoal;
    const pfpPreview = $('#pfpPreview');
    if (pfpPreview) {
      if (state.userPfp) {
        pfpPreview.innerHTML = `<img src="${state.userPfp}" alt="Profile" class="pfp-preview-img"/>`;
      } else {
        pfpPreview.innerHTML = `<span class="pfp-placeholder">${(state.userName || 'A')[0].toUpperCase()}</span>`;
      }
    }

    const themeToggle = $('#themeToggle');
    themeToggle.classList.toggle('active', state.theme === 'dark');

    const nudgeToggle = $('#nudgeToggle');
    nudgeToggle.classList.toggle('active', state.nudgesEnabled);

    $('#nudgeInterval').value = state.nudgeInterval;

    renderArchivedList();
  }

  function renderArchivedList() {
    const container = $('#archivedList');
    if (state.archived.length === 0) {
      container.innerHTML = '<div class="empty-small">No archived habits.</div>';
      return;
    }
    container.innerHTML = state.archived.map(h => `
      <div class="archived-item">
        <span class="archived-item-name">${h.emoji || '🎯'} ${escapeHtml(h.name)}</span>
        <button class="restore-btn" data-restore="${h.id}">Restore</button>
      </div>`).join('');

    container.querySelectorAll('.restore-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.restore;
        const idx = state.archived.findIndex(h => h.id === id);
        if (idx !== -1) {
          state.habits.push(state.archived.splice(idx, 1)[0]);
          saveState();
          renderSettings();
          showToast('Habit restored');
        }
      });
    });
  }

  // ── Calculations ─────────────────────────────────────────
  function getCompletionRate() {
    const scheduled = state.habits.filter(h => isHabitScheduledToday(h));
    if (scheduled.length === 0) return 0;
    const today = todayKey();
    const comps = state.completions[today] || [];
    const done = scheduled.filter(h => comps.includes(h.id)).length;
    return Math.round((done / scheduled.length) * 100);
  }

  function getWeeklyCompletionRate() {
    let total = 0, done = 0;
    for (let i = 0; i < 7; i++) {
      const key = daysAgo(i);
      const d = new Date(); d.setDate(d.getDate() - i);
      const scheduled = state.habits.filter(h => isHabitScheduledOn(h, d));
      total += scheduled.length;
      const comps = state.completions[key] || [];
      done += scheduled.filter(h => comps.includes(h.id)).length;
    }
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }

  function calculateStreak() {
    let streak = 0;
    const todayComps = state.completions[todayKey()] || [];
    let start = todayComps.length > 0 ? 0 : 1;
    for (let i = start; i < 365; i++) {
      if ((state.completions[daysAgo(i)] || []).length > 0) streak++;
      else break;
    }
    return streak;
  }

  function calculateBestStreak() {
    let best = 0, current = 0;
    for (let i = 0; i < 365; i++) {
      if ((state.completions[daysAgo(i)] || []).length > 0) { current++; best = Math.max(best, current); }
      else current = 0;
    }
    return best;
  }

  function calculateDaysActive() {
    return Object.keys(state.completions).filter(k => (state.completions[k] || []).length > 0).length;
  }

  function calculateWeeklyAvg() {
    let total = 0;
    for (let i = 0; i < 7; i++) total += (state.completions[daysAgo(i)] || []).length;
    return Math.round(total / 7);
  }

  function calcHabitStreak(habit) {
    let streak = 0;
    const todayComps = state.completions[todayKey()] || [];
    let start = todayComps.includes(habit.id) ? 0 : 1;
    for (let i = start; i < 365; i++) {
      if ((state.completions[daysAgo(i)] || []).includes(habit.id)) streak++;
      else break;
    }
    return streak;
  }

  function calcHabitBestStreak(habit) {
    let best = 0, cur = 0;
    for (let i = 0; i < 365; i++) {
      if ((state.completions[daysAgo(i)] || []).includes(habit.id)) { cur++; best = Math.max(best, cur); }
      else cur = 0;
    }
    return best;
  }

  function calcHabitTotal(habit) {
    let total = 0;
    Object.values(state.completions).forEach(c => { if (c.includes(habit.id)) total++; });
    return total;
  }

  function calcHabitRate(habit) {
    const created = new Date(habit.createdAt || Date.now());
    let scheduled = 0, done = 0;
    const today = new Date();
    for (let d = new Date(created); d <= today; d.setDate(d.getDate() + 1)) {
      if (isHabitScheduledOn(habit, d)) {
        scheduled++;
        if ((state.completions[dateKey(d)] || []).includes(habit.id)) done++;
      }
    }
    return scheduled === 0 ? 0 : Math.round((done / scheduled) * 100);
  }

  // ── Focus Mode ───────────────────────────────────────────
  function openFocus() {
    if (state.habits.length === 0) { showToast('Add a habit first'); return; }
    const today = todayKey();
    const comps = state.completions[today] || [];
    const scheduled = state.habits.filter(h => isHabitScheduledToday(h));
    const incomplete = scheduled.findIndex(h => !comps.includes(h.id));
    focusIndex = incomplete >= 0 ? incomplete : 0;
    renderFocus();
    $('#focusOverlay').classList.add('active');
  }

  function closeFocus() { $('#focusOverlay').classList.remove('active'); }

  function renderFocus() {
    const scheduled = state.habits.filter(h => isHabitScheduledToday(h));
    if (scheduled.length === 0) { closeFocus(); return; }
    const habit = scheduled[focusIndex] || scheduled[0];
    const today = todayKey();
    const comps = state.completions[today] || [];
    const done = comps.includes(habit.id);

    $('#focusContent').innerHTML = `
      <div style="font-size:3rem;margin-bottom:12px">${habit.emoji || '🎯'}</div>
      <div class="focus-habit-name">${escapeHtml(habit.name)}</div>
      <div class="focus-habit-cat">${habit.category || 'General'} · ${habit.frequency || 'Daily'}</div>
      <div class="focus-checkbox ${done ? 'completed' : ''}" id="focusCheck">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="focus-nav">
        <button class="focus-nav-btn" id="focusPrev"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>
        <button class="focus-nav-btn" id="focusNext"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>
      </div>
      <div class="focus-progress">${focusIndex + 1} of ${scheduled.length}</div>`;

    $('#focusCheck').addEventListener('click', () => {
      toggleHabit(habit.id);
      renderFocus();
    });
    $('#focusPrev').addEventListener('click', () => {
      focusIndex = (focusIndex - 1 + scheduled.length) % scheduled.length;
      renderFocus();
    });
    $('#focusNext').addEventListener('click', () => {
      focusIndex = (focusIndex + 1) % scheduled.length;
      renderFocus();
    });
  }

  // ── Toast & Nudge ────────────────────────────────────────
  function showToast(msg) {
    clearTimeout(toastTimeout);
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    toastTimeout = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function showNudge(msg) {
    $('#nudgeText').textContent = msg;
    $('#nudge').classList.add('show');
    setTimeout(() => $('#nudge').classList.remove('show'), 8000);
  }

  function startNudges() {
    clearInterval(nudgeTimer);
    if (!state.nudgesEnabled) return;
    nudgeTimer = setInterval(() => {
      if (!state.nudgesEnabled) { clearInterval(nudgeTimer); return; }
      const today = todayKey();
      const comps = state.completions[today] || [];
      const incomplete = state.habits.filter(h => isHabitScheduledToday(h) && !comps.includes(h.id));
      if (incomplete.length > 0) {
        const h = incomplete[Math.floor(Math.random() * incomplete.length)];
        const msgs = [
          `A gentle reminder to check in on "${h.name}".`,
          `Have you had a chance to work on "${h.name}" today?`,
          `Small steps matter. How about "${h.name}"?`,
        ];
        showNudge(msgs[Math.floor(Math.random() * msgs.length)]);
      }
    }, state.nudgeInterval * 60 * 1000);
  }

  // ── Confirm Dialog ───────────────────────────────────────
  function showConfirm(title, desc, callback) {
    $('#confirmTitle').textContent = title;
    $('#confirmDesc').textContent = desc;
    confirmCallback = callback;
    $('#confirmOverlay').classList.add('active');
  }

  function closeConfirm() {
    $('#confirmOverlay').classList.remove('active');
    confirmCallback = null;
  }

  // ── Export / Import ──────────────────────────────────────
  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `pushabit-backup-${todayKey()}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported');
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.habits && data.completions) {
          state = { ...state, ...data, onboarded: true };
          saveState();
          navigate('dashboard');
          showToast('Data imported successfully');
        } else {
          showToast('Invalid file format');
        }
      } catch { showToast('Failed to parse file'); }
    };
    reader.readAsText(file);
  }

  // ── Number Animation ─────────────────────────────────────
  function animateNumber(el, target) {
    if (!el) return;
    const duration = 700;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * ease);
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ── Filter Dropdown ──────────────────────────────────────
  function toggleFilterDropdown() {
    const dd = $('#filterDropdown');
    const btn = $('#filterBtn');
    if (dd.classList.contains('active')) {
      dd.classList.remove('active');
      return;
    }
    const rect = btn.getBoundingClientRect();
    dd.style.top = (rect.bottom + 4) + 'px';
    dd.style.right = (window.innerWidth - rect.right) + 'px';
    dd.classList.add('active');
  }

  // ── Bind All Events ──────────────────────────────────────
  function bindEvents() {
    // Bottom Nav
    $$('.nav-item').forEach(n => n.addEventListener('click', () => navigate(n.dataset.nav)));

    // "See All" and quick stat links
    $$('[data-nav]').forEach(el => {
      if (!el.classList.contains('nav-item')) {
        el.addEventListener('click', () => navigate(el.dataset.nav));
      }
    });

    // Back buttons
    $$('.back-btn').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.back)));

    // Avatar → settings
    const avatarBtn = $('#avatarBtn');
    if (avatarBtn) avatarBtn.addEventListener('click', () => navigate('settings'));

    // Add Habit
    $('#addHabitBtn')?.addEventListener('click', () => openHabitModal(null));
    $('#modalCancel')?.addEventListener('click', closeHabitModal);
    $('#modalConfirm')?.addEventListener('click', confirmHabitModal);
    $('#modalOverlay')?.addEventListener('click', e => { if (e.target === $('#modalOverlay')) closeHabitModal(); });
    $('#habitInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') confirmHabitModal(); if (e.key === 'Escape') closeHabitModal(); });

    // Category chip selection
    $$('#categoryChips .cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('#categoryChips .cat-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
    });

    // Frequency chip selection
    $$('#freqOptions .freq-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('#freqOptions .freq-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        $('#customDays').style.display = chip.dataset.freq === 'custom' ? 'flex' : 'none';
      });
    });

    // Custom day chips
    $$('#customDays .day-chip').forEach(chip => {
      chip.addEventListener('click', () => chip.classList.toggle('selected'));
    });

    // Emoji picker
    $$('#emojiPicker .emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('#emojiPicker .emoji-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Focus Mode
    $('#focusModeBtn')?.addEventListener('click', openFocus);
    $('#focusCloseBtn')?.addEventListener('click', closeFocus);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if ($('#focusOverlay').classList.contains('active')) closeFocus();
        if ($('#modalOverlay').classList.contains('active')) closeHabitModal();
        if ($('#noteModalOverlay').classList.contains('active')) closeNoteModal();
        if ($('#confirmOverlay').classList.contains('active')) closeConfirm();
        if ($('#filterDropdown').classList.contains('active')) $('#filterDropdown').classList.remove('active');
      }
    });

    // Filter
    $('#filterBtn')?.addEventListener('click', toggleFilterDropdown);
    $$('#filterDropdown .dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        currentFilter = item.dataset.filter;
        $$('#filterDropdown .dropdown-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const labels = { all: 'All', pending: 'Pending', completed: 'Done' };
        $('#filterLabel').textContent = labels[currentFilter] || currentFilter.split(':')[1] || 'All';
        $('#filterDropdown').classList.remove('active');
        renderHabits();
      });
    });

    // Close dropdown on outside click
    document.addEventListener('click', e => {
      if (!e.target.closest('#filterBtn') && !e.target.closest('#filterDropdown')) {
        $('#filterDropdown')?.classList.remove('active');
      }
    });

    // Edit habit (in detail view)
    $('#editHabitBtn')?.addEventListener('click', () => {
      if (selectedHabitId) openHabitModal(selectedHabitId);
    });

    // Archive / Delete habit
    $('#archiveHabitBtn')?.addEventListener('click', () => {
      showConfirm('Archive Habit', 'This habit will be moved to your archives. You can restore it later.', () => {
        const idx = state.habits.findIndex(h => h.id === selectedHabitId);
        if (idx !== -1) {
          state.archived.push(state.habits.splice(idx, 1)[0]);
          saveState();
          navigate('dashboard');
          showToast('Habit archived');
        }
      });
    });

    $('#deleteHabitBtn')?.addEventListener('click', () => {
      showConfirm('Delete Permanently', 'This habit and all its data will be permanently deleted.', () => {
        state.habits = state.habits.filter(h => h.id !== selectedHabitId);
        Object.keys(state.completions).forEach(k => {
          state.completions[k] = state.completions[k].filter(id => id !== selectedHabitId);
        });
        delete state.notes[selectedHabitId];
        saveState();
        navigate('dashboard');
        showToast('Habit deleted');
      });
    });

    // Confirm dialog
    $('#confirmCancel')?.addEventListener('click', closeConfirm);
    $('#confirmOk')?.addEventListener('click', () => {
      if (confirmCallback) confirmCallback();
      closeConfirm();
    });
    $('#confirmOverlay')?.addEventListener('click', e => { if (e.target === $('#confirmOverlay')) closeConfirm(); });

    // Detail calendar nav
    $('#calPrev')?.addEventListener('click', () => {
      detailCalMonth--; if (detailCalMonth < 0) { detailCalMonth = 11; detailCalYear--; }
      const h = state.habits.find(x => x.id === selectedHabitId);
      if (h) renderDetailCalendar(h);
    });
    $('#calNext')?.addEventListener('click', () => {
      detailCalMonth++; if (detailCalMonth > 11) { detailCalMonth = 0; detailCalYear++; }
      const h = state.habits.find(x => x.id === selectedHabitId);
      if (h) renderDetailCalendar(h);
    });

    // Calendar view nav
    $('#calViewPrev')?.addEventListener('click', () => {
      calViewMonth--; if (calViewMonth < 0) { calViewMonth = 11; calViewYear--; }
      calViewSelectedDay = null;
      renderCalendarView();
    });
    $('#calViewNext')?.addEventListener('click', () => {
      calViewMonth++; if (calViewMonth > 11) { calViewMonth = 0; calViewYear++; }
      calViewSelectedDay = null;
      renderCalendarView();
    });

    // Notes
    $('#addNoteBtn')?.addEventListener('click', () => {
      if (!selectedHabitId) return;
      $('#noteModalOverlay').classList.add('active');
      $('#noteInput').value = '';
      setTimeout(() => $('#noteInput').focus(), 300);
    });
    $('#noteCancelBtn')?.addEventListener('click', closeNoteModal);
    $('#noteConfirmBtn')?.addEventListener('click', () => {
      const text = $('#noteInput').value.trim();
      if (!text) return;
      if (!state.notes[selectedHabitId]) state.notes[selectedHabitId] = [];
      state.notes[selectedHabitId].push({ text, date: Date.now() });
      saveState();
      closeNoteModal();
      const h = state.habits.find(x => x.id === selectedHabitId);
      if (h) renderNotes(h);
      showToast('Note saved');
    });
    $('#noteModalOverlay')?.addEventListener('click', e => { if (e.target === $('#noteModalOverlay')) closeNoteModal(); });

    // Settings
    $('#themeToggle')?.addEventListener('click', () => {
      applyTheme(state.theme === 'light' ? 'dark' : 'light');
      showToast(state.theme === 'dark' ? 'Dark mode' : 'Light mode');
    });

    $('#nudgeToggle')?.addEventListener('click', () => {
      state.nudgesEnabled = !state.nudgesEnabled;
      $('#nudgeToggle').classList.toggle('active', state.nudgesEnabled);
      saveState();
      startNudges();
      showToast(state.nudgesEnabled ? 'Nudges enabled' : 'Nudges disabled');
    });

    $('#nudgeInterval')?.addEventListener('change', () => {
      state.nudgeInterval = +$('#nudgeInterval').value;
      saveState();
      startNudges();
    });

    $('#saveProfileBtn')?.addEventListener('click', () => {
      state.userName = $('#settingsName').value.trim();
      state.userEmail = $('#settingsEmail').value.trim();
      state.streakGoal = parseInt($('#settingsGoal').value) || 30;
      saveState();
      showToast('Profile saved');
    });

    // Profile picture upload
    $('#pfpUploadBtn')?.addEventListener('click', () => $('#pfpInput').click());
    $('#pfpInput')?.addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('Please select an image'); return; }
      if (file.size > 500000) { showToast('Image too large (max 500KB)'); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        state.userPfp = ev.target.result;
        saveState();
        renderSettings();
        showToast('Profile picture updated');
      };
      reader.readAsDataURL(file);
    });
    $('#pfpRemoveBtn')?.addEventListener('click', () => {
      state.userPfp = '';
      saveState();
      renderSettings();
      showToast('Profile picture removed');
    });

    $('#exportBtn')?.addEventListener('click', exportData);
    $('#importFile')?.addEventListener('change', e => {
      if (e.target.files[0]) importData(e.target.files[0]);
    });

    $('#resetBtn')?.addEventListener('click', () => {
      showConfirm('Reset All Data', 'This will permanently delete all your habits, stats, and settings.', () => {
        localStorage.removeItem(STORAGE_KEY);
        state = loadState();
        navigate('onboarding');
        showToast('All data cleared');
      });
    });

    // Nudge dismiss
    $('#nudgeDismiss')?.addEventListener('click', () => $('#nudge').classList.remove('show'));
  }

  function closeNoteModal() { $('#noteModalOverlay').classList.remove('active'); }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    applyTheme(state.theme);
    setupOnboarding();
    bindEvents();

    if (!state.onboarded) {
      navigate('onboarding');
    } else {
      navigate('dashboard');
      startNudges();
      // Welcome nudge
      setTimeout(() => {
        const comps = state.completions[todayKey()] || [];
        if (comps.length === 0 && state.habits.length > 0) {
          showNudge('Welcome back. Take a moment to check in on your habits.');
        }
      }, 3000);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
