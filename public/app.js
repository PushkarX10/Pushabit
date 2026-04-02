/* ═══════════════════════════════════════════════════
   AURA — Gamified Habit Tracker  ·  Client App
   ═══════════════════════════════════════════════════ */

// ─── State ───
let state = {
  user: {}, habits: [], quests: [], skills: {},
  timer: {}, inventory: [], weeklyGrowth: [],
  lootProgress: 0, lootTarget: 4, friends: []
};
let currentView = 'habits';
let timerInterval = null;
let timerSeconds = 0;

// ─── DOM Refs ───
const $app = document.getElementById('app');
const $navItems = document.querySelectorAll('.nav-item');
const $modal = document.getElementById('modal-overlay');
const $modalContent = document.getElementById('modal-content');
const $toastContainer = document.getElementById('toast-container');
const $focusBadge = document.getElementById('focus-badge');

// ─── Init ───
async function init() {
  // Check if user is authenticated (has email set = registered)
  const authOk = await checkAuth();
  if (!authOk) {
    window.location.href = '/login.html';
    return;
  }
  
  await loadState();
  setupNav();
  window.addEventListener('hashchange', handleHashChange);
  updateHeaderAvatar();
  // Determine initial view from hash
  const hash = window.location.hash.replace('#', '');
  if (['habits', 'quests', 'dashboard', 'timer', 'friends'].includes(hash)) {
    currentView = hash;
  }
  renderView(currentView);
}

// ─── Auth Check ───
async function checkAuth() {
  try {
    const res = await fetch('/api/auth/check');
    if (res.ok) {
      const data = await res.json();
      return data.authenticated;
    }
    return false;
  } catch (e) {
    return false;
  }
}



function handleHashChange() {
  const hash = window.location.hash.replace('#', '');
  if (['habits', 'quests', 'dashboard', 'timer', 'friends'].includes(hash) && hash !== currentView) {
    renderView(hash);
  }
}

async function loadState() {
  try {
    const res = await fetch('/api/state');
    state = await res.json();
  } catch (e) {
    console.error('Failed to load state', e);
  }
}

// ─── Navigation ───
function setupNav() {
  $navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      renderView(view);
    });
  });
}

function setActiveNav(view) {
  $navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });
}

function renderView(view) {
  currentView = view;
  setActiveNav(view);
  window.location.hash = view;
  renderFab(''); // Clear FAB by default

  // Fade transition
  $app.style.opacity = '0';
  $app.style.transform = 'translateY(8px)';

  setTimeout(() => {
    switch (view) {
      case 'habits': renderHabits(); break;
      case 'quests': renderQuests(); break;
      case 'dashboard': renderDashboard(); break;
      case 'timer': renderTimer(); break;
      case 'friends': renderFriends(); break;
      default: renderHabits();
    }
    requestAnimationFrame(() => {
      $app.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      $app.style.opacity = '1';
      $app.style.transform = 'translateY(0)';
    });
  }, 150);
}

// ─── FAB Loader ───
function renderFab(html) {
  let container = document.getElementById('fab-container');
  if (container) {
    if (html.trim()) {
      container.innerHTML = html.trim();
      container.firstElementChild.classList.add('fade-in');
    } else {
      container.innerHTML = '';
    }
  }
}

// ─── Toast ───
function showToast(message, icon = 'check_circle') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="material-symbols-outlined" style="font-size:18px">${icon}</span>${message}`;
  $toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ─── Modal ───
function openModal(html) {
  $modalContent.innerHTML = html;
  $modal.classList.add('show');
  $modal.style.display = 'flex';
  // Close on overlay click
  $modal.onclick = (e) => {
    if (e.target === $modal) closeModal();
  };
}

function closeModal() {
  $modal.classList.remove('show');
  setTimeout(() => { $modal.style.display = 'none'; }, 200);
}

// ─── API Helpers ───
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  return res.json();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HABITS VIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderHabits() {
  const completedCount = state.habits.filter(h => h.completedToday).length;
  const totalCount = state.habits.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  $app.innerHTML = `
    <div class="fade-in">
      <!-- Header Section -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-1">
          <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-1">Today's Rituals</p>
            <h2 class="text-3xl font-bold text-on-background">${getGreeting()}</h2>
          </div>
        </div>
        <p class="text-sm text-on-surface-variant mt-2">
          ${completedCount}/${totalCount} completed · ${pct}% done
        </p>
        <!-- Daily Progress -->
        <div class="mt-3">
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
      </div>

      <!-- Habit Cards -->
      <div class="stagger-children space-y-3 pb-24" id="habit-list">
        ${state.habits.map(h => habitCard(h)).join('')}
      </div>
    </div>
  `;

  renderFab(`
    <div class="mobile-fab fixed bottom-36 right-6 z-40">
      <button onclick="openAddHabitModal()" class="fab" id="fab-add-habit">
        <span class="material-symbols-outlined">add</span>
      </button>
    </div>
  `);
}

function habitCard(h) {
  const done = h.completedToday;
  const categoryColors = {
    mental: { bg: 'bg-indigo-50', icon: 'text-indigo-500', border: 'border-indigo-200' },
    physical: { bg: 'bg-emerald-50', icon: 'text-emerald-500', border: 'border-emerald-200' },
    creative: { bg: 'bg-amber-50', icon: 'text-amber-500', border: 'border-amber-200' },
    social: { bg: 'bg-rose-50', icon: 'text-rose-500', border: 'border-rose-200' }
  };
  const cat = categoryColors[h.category] || categoryColors.mental;

  return `
    <div class="aura-card aura-glow p-4 flex items-center gap-4 cursor-pointer transition-all ${done ? 'opacity-60' : ''}"
         onclick="toggleHabit('${h.id}')" id="habit-${h.id}">
      <div class="w-12 h-12 rounded-xl ${done ? 'bg-primary' : cat.bg} flex items-center justify-center shrink-0 transition-colors">
        <span class="material-symbols-outlined ${done ? 'text-white check-pop' : cat.icon}" style="font-variation-settings:'FILL' ${done ? 1 : 0}">
          ${done ? 'check_circle' : h.icon}
        </span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-sm ${done ? 'line-through text-on-surface-variant' : 'text-on-background'}">${h.title}</p>
        <p class="text-xs text-on-surface-variant mt-0.5 truncate">${h.description}</p>
      </div>
      <div class="text-right shrink-0">
        <p class="text-xs font-bold text-primary">+${h.xpReward} XP</p>
        ${h.currentStreak > 0 ? `<p class="text-[10px] text-on-surface-variant mt-0.5">🔥 ${h.currentStreak}d</p>` : ''}
      </div>
    </div>
  `;
}

async function toggleHabit(id) {
  try {
    const data = await api(`/api/habits/${id}/toggle`, 'POST');
    state.user = data.user;
    // Update the habit in state
    const idx = state.habits.findIndex(h => h.id === id);
    if (idx !== -1) state.habits[idx] = data.habit;

    if (data.habit.completedToday) {
      showToast(`+${data.habit.xpReward} XP earned!`, 'bolt');
    } else {
      showToast('Habit unchecked', 'undo');
    }
    renderHabits();
  } catch (e) {
    showToast('Error toggling habit', 'error');
  }
}

function openAddHabitModal() {
  openModal(`
    <div>
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-bold text-on-background">New Habit</h3>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-background transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <form id="add-habit-form" class="space-y-4">
        <div>
          <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Title</label>
          <input type="text" name="title" class="aura-input" placeholder="e.g. Morning Run" required/>
        </div>
        <div>
          <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Description</label>
          <input type="text" name="description" class="aura-input" placeholder="Short description"/>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Category</label>
            <select name="category" class="aura-select">
              <option value="mental">🧠 Mental</option>
              <option value="physical">💪 Physical</option>
              <option value="creative">🎨 Creative</option>
              <option value="social">🤝 Social</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">XP Reward</label>
            <input type="number" name="xpReward" class="aura-input" value="100" min="10" max="500"/>
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Icon</label>
          <div class="grid grid-cols-6 gap-2" id="icon-picker">
            ${['check_circle','self_improvement','auto_stories','fitness_center','palette','code','music_note','restaurant','water_drop','bedtime','directions_run','emoji_events']
              .map((ic, i) => `
                <label class="cursor-pointer flex items-center justify-center p-2 rounded-xl border-2 transition-colors ${i === 0 ? 'border-primary bg-primary/10' : 'border-transparent hover:border-outline-variant'}">
                  <input type="radio" name="icon" value="${ic}" class="hidden" ${i === 0 ? 'checked' : ''} onchange="document.querySelectorAll('#icon-picker label').forEach(l=>l.className='cursor-pointer flex items-center justify-center p-2 rounded-xl border-2 transition-colors border-transparent hover:border-outline-variant');this.parentElement.className='cursor-pointer flex items-center justify-center p-2 rounded-xl border-2 transition-colors border-primary bg-primary/10'"/>
                  <span class="material-symbols-outlined text-on-surface-variant">${ic}</span>
                </label>
              `).join('')}
          </div>
        </div>
        <button type="submit" class="w-full py-3.5 rounded-xl font-semibold text-sm gradient-aura text-white transition-all hover:shadow-lg active:scale-[0.98]">
          Create Habit
        </button>
      </form>
    </div>
  `);

  document.getElementById('add-habit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd);
    const habit = await api('/api/habits', 'POST', body);
    state.habits.push({ ...habit, completedToday: false, currentStreak: 0 });
    closeModal();
    showToast('Habit created!', 'add_task');
    renderHabits();
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  QUESTS VIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderQuests() {
  const active = state.quests.filter(q => !q.completed);
  const completed = state.quests.filter(q => q.completed);

  $app.innerHTML = `
    <div class="fade-in">
      <div class="mb-8">
        <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-1">Quest Board</p>
        <h2 class="text-3xl font-bold text-on-background">Active Quests</h2>
        <p class="text-sm text-on-surface-variant mt-2">${active.length} active · ${completed.length} completed</p>
      </div>

      <div class="stagger-children space-y-4" id="quest-list">
        ${active.length === 0 ? `
          <div class="text-center py-16 text-on-surface-variant">
            <span class="material-symbols-outlined text-5xl mb-3 block opacity-30">flag</span>
            <p class="font-medium">No active quests</p>
            <p class="text-sm mt-1">Create one to get started</p>
          </div>
        ` : active.map(q => questCard(q)).join('')}
      </div>

      ${completed.length > 0 ? `
        <div class="mt-10">
          <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-4">Completed</p>
          <div class="space-y-3 opacity-50">
            ${completed.map(q => `
              <div class="aura-card p-4">
                <p class="font-semibold text-sm line-through">${q.title}</p>
                <p class="text-xs text-on-surface-variant mt-1">+${q.xpReward} XP earned</p>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;

  renderFab(`
    <div class="mobile-fab fixed bottom-36 right-6 z-40">
      <button onclick="openAddQuestModal()" class="fab" id="fab-add-quest">
        <span class="material-symbols-outlined">add</span>
      </button>
    </div>
  `);
}

function questCard(q) {
  const completedObj = q.objectives.filter(o => o.completed).length;
  const totalObj = q.objectives.length;
  const pct = totalObj > 0 ? Math.round((completedObj / totalObj) * 100) : 0;
  const diffColors = {
    Beginner: 'bg-emerald-100 text-emerald-700',
    Intermediate: 'bg-amber-100 text-amber-700',
    Advanced: 'bg-rose-100 text-rose-700'
  };

  return `
    <div class="aura-card aura-glow p-5" id="quest-${q.id}">
      <div class="flex items-start justify-between mb-3">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${diffColors[q.difficulty] || 'bg-gray-100 text-gray-600'}">${q.difficulty}</span>
            <span class="text-[10px] text-on-surface-variant uppercase tracking-wider">${q.category}</span>
          </div>
          <h3 class="font-bold text-on-background">${q.title}</h3>
          <p class="text-xs text-on-surface-variant mt-1 line-clamp-2">${q.description}</p>
        </div>
        <button onclick="event.stopPropagation();deleteQuest('${q.id}')" class="text-on-surface-variant hover:text-error transition-colors ml-3 shrink-0">
          <span class="material-symbols-outlined" style="font-size:18px">delete</span>
        </button>
      </div>

      <!-- Objectives -->
      <div class="mt-4 space-y-2">
        ${q.objectives.map(obj => `
          <div class="objective-item flex items-center gap-3 p-2.5 rounded-xl cursor-pointer"
               onclick="toggleObjective('${q.id}','${obj.id}')">
            <div class="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
              ${obj.completed ? 'bg-primary border-primary' : 'border-outline-variant'}">
              ${obj.completed ? '<span class="material-symbols-outlined text-white" style="font-size:14px">check</span>' : ''}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm ${obj.completed ? 'line-through text-on-surface-variant' : 'text-on-background'}">${obj.title}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Progress & Complete -->
      <div class="mt-4 flex items-center justify-between">
        <div class="flex-1 mr-4">
          <div class="progress-bar">
            <div class="progress-bar-fill" style="width:${pct}%"></div>
          </div>
          <p class="text-[10px] text-on-surface-variant mt-1">${completedObj}/${totalObj} objectives</p>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-bold text-primary">+${q.xpReward} XP</span>
          ${pct === 100 ? `
            <button onclick="completeQuest('${q.id}')"
                    class="px-4 py-2 rounded-xl text-xs font-bold gradient-aura text-white transition-all hover:shadow-lg active:scale-95">
              Claim
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

async function toggleObjective(questId, objId) {
  try {
    const quest = await api(`/api/quests/${questId}/objectives/${objId}/toggle`, 'POST');
    const idx = state.quests.findIndex(q => q.id === questId);
    if (idx !== -1) state.quests[idx] = quest;
    renderQuests();
  } catch (e) {
    showToast('Error updating objective', 'error');
  }
}

async function completeQuest(questId) {
  try {
    const data = await api(`/api/quests/${questId}/complete`, 'POST');
    state.user = data.user;
    const idx = state.quests.findIndex(q => q.id === questId);
    if (idx !== -1) state.quests[idx] = data.quest;
    showToast(`Quest complete! +${data.quest.xpReward} XP`, 'emoji_events');
    renderQuests();
  } catch (e) {
    showToast('Error completing quest', 'error');
  }
}

async function deleteQuest(questId) {
  if (!confirm('Delete this quest?')) return;
  await api(`/api/quests/${questId}`, 'DELETE');
  state.quests = state.quests.filter(q => q.id !== questId);
  showToast('Quest deleted', 'delete');
  renderQuests();
}

function openAddQuestModal() {
  openModal(`
    <div>
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-bold text-on-background">New Quest</h3>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-background transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <form id="add-quest-form" class="space-y-4">
        <div>
          <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Title</label>
          <input type="text" name="title" class="aura-input" placeholder="e.g. Master TypeScript" required/>
        </div>
        <div>
          <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Description</label>
          <textarea name="description" class="aura-input" rows="2" placeholder="Quest details..."></textarea>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Category</label>
            <input type="text" name="category" class="aura-input" value="General"/>
          </div>
          <div>
            <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Difficulty</label>
            <select name="difficulty" class="aura-select">
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Advanced">Advanced</option>
            </select>
          </div>
        </div>
        <div>
          <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">XP Reward</label>
          <input type="number" name="xpReward" class="aura-input" value="200" min="50" max="1000"/>
        </div>
        <div>
          <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Objectives</label>
          <div id="quest-objectives" class="space-y-2">
            <div class="flex gap-2">
              <input type="text" class="aura-input quest-obj-input" placeholder="Objective 1"/>
              <button type="button" onclick="addObjectiveField()" class="shrink-0 w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors">
                <span class="material-symbols-outlined" style="font-size:20px">add</span>
              </button>
            </div>
          </div>
        </div>
        <button type="submit" class="w-full py-3.5 rounded-xl font-semibold text-sm gradient-aura text-white transition-all hover:shadow-lg active:scale-[0.98]">
          Create Quest
        </button>
      </form>
    </div>
  `);

  document.getElementById('add-quest-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const objectives = [...document.querySelectorAll('.quest-obj-input')]
      .map(inp => inp.value.trim())
      .filter(Boolean)
      .map(title => ({ title }));
    const body = { ...Object.fromEntries(fd), objectives };
    const quest = await api('/api/quests', 'POST', body);
    state.quests.push(quest);
    closeModal();
    showToast('Quest created!', 'flag');
    renderQuests();
  });
}

function addObjectiveField() {
  const container = document.getElementById('quest-objectives');
  const count = container.querySelectorAll('.quest-obj-input').length + 1;
  const div = document.createElement('div');
  div.className = 'flex gap-2';
  div.innerHTML = `
    <input type="text" class="aura-input quest-obj-input" placeholder="Objective ${count}"/>
    <button type="button" onclick="this.parentElement.remove()" class="shrink-0 w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-error/60 hover:text-error transition-colors">
      <span class="material-symbols-outlined" style="font-size:20px">remove</span>
    </button>
  `;
  container.appendChild(div);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DASHBOARD VIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderDashboard() {
  const u = state.user;
  const xpPct = u.xpToNext > 0 ? Math.round((u.xp / u.xpToNext) * 100) : 0;
  const circumference = 2 * Math.PI * 56;
  const ringOffset = circumference - (xpPct / 100) * circumference;

  // Weekly growth chart
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const maxGrowth = Math.max(...state.weeklyGrowth, 1);
  const today = new Date().getDay();

  // Daily XP goal
  const dailyPct = Math.min(100, Math.round((u.dailyXpEarned / u.dailyXpGoal) * 100));

  $app.innerHTML = `
    <div class="fade-in">
      <div class="mb-6">
        <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-1">Command Center</p>
        <h2 class="text-3xl font-bold text-on-background">Dashboard</h2>
      </div>

      <!-- Profile Card -->
      <div class="aura-card gradient-aura p-6 mb-4">
        <div class="flex items-center gap-5">
          <div class="xp-ring-container shrink-0">
            <svg class="xp-ring-svg" viewBox="0 0 128 128">
              <circle class="xp-ring-bg" cx="64" cy="64" r="56" stroke="rgba(255,255,255,0.15)"/>
              <circle class="xp-ring-progress" cx="64" cy="64" r="56"
                stroke="white" stroke-dasharray="${circumference}" stroke-dashoffset="${ringOffset}"/>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-3xl font-bold text-white">${u.level}</span>
              <span class="text-[10px] uppercase tracking-widest text-white/70 font-semibold">Level</span>
            </div>
          </div>
          <div class="text-white">
            <p class="font-bold text-xl">${u.name}</p>
            <p class="text-white/70 text-sm mt-1">${u.xp} / ${u.xpToNext} XP</p>
            <div class="flex items-center gap-4 mt-3">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined" style="font-size:16px">local_fire_department</span>
                <span class="text-sm font-semibold">${u.streak}d streak</span>
              </div>
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined" style="font-size:16px">timer</span>
                <span class="text-sm font-semibold">${u.totalFocusMinutes}m focus</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Daily XP Goal -->
      <div class="aura-card p-5 mb-4">
        <div class="flex items-center justify-between mb-2">
          <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">Daily XP Goal</p>
          <p class="text-sm font-bold text-primary">${u.dailyXpEarned} / ${u.dailyXpGoal}</p>
        </div>
        <div class="progress-bar" style="height:8px">
          <div class="progress-bar-fill" style="width:${dailyPct}%;${dailyPct >= 100 ? 'background:linear-gradient(90deg,#777491,#9b59b6)' : ''}"></div>
        </div>
        ${dailyPct >= 100 ? '<p class="text-[10px] text-primary font-semibold mt-2 text-center">🎉 Daily goal reached!</p>' : ''}
      </div>

      <!-- Weekly Growth Chart -->
      <div class="aura-card p-5 mb-4">
        <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-4">Weekly Growth</p>
        <div class="flex items-end justify-between gap-2" style="height:120px">
          ${state.weeklyGrowth.map((val, i) => {
            const h = maxGrowth > 0 ? Math.max(4, (val / maxGrowth) * 100) : 4;
            return `
              <div class="flex-1 flex flex-col items-center gap-1">
                <span class="text-[10px] font-semibold text-on-surface-variant">${val > 0 ? val : ''}</span>
                <div class="w-full bar-chart-bar ${i === today ? 'today' : ''}"
                     style="height:${h}%;background:${i === today ? '' : 'rgba(119,116,145,0.15)'}"></div>
                <span class="text-[10px] text-on-surface-variant font-medium">${dayLabels[i]}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Inventory -->
      <div class="aura-card p-5 mb-4">
        <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-4">Inventory</p>
        <div class="grid grid-cols-6 gap-3">
          ${state.inventory.map(item => `
            <div class="aspect-square rounded-xl flex items-center justify-center transition-all
              ${item.unlocked
                ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
                : 'bg-surface-container-high text-on-surface-variant/30'}"
              title="${item.name}">
              <span class="material-symbols-outlined" style="font-size:24px;font-variation-settings:'FILL' ${item.unlocked ? 1 : 0}">${item.icon}</span>
            </div>
          `).join('')}
        </div>
      </div>

    </div>
  `;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TIMER VIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function renderTimer() {
  const t = state.timer;
  timerSeconds = t.remaining;

  const mins = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const secs = (timerSeconds % 60).toString().padStart(2, '0');

  // Timer ring calculations
  const totalDuration = t.duration;
  const pct = totalDuration > 0 ? ((totalDuration - timerSeconds) / totalDuration) * 100 : 0;
  const circumference = 2 * Math.PI * 90;
  const offset = circumference - (pct / 100) * circumference;

  $app.innerHTML = `
    <div class="fade-in flex flex-col items-center justify-center" style="min-height: calc(100dvh - 14rem)">
      <div class="text-center">
        <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-2">Focus Session</p>

        <!-- Timer Ring -->
        <div class="relative mx-auto mb-8 timer-ring-shell">
          <svg viewBox="0 0 200 200" style="position:absolute;top:0;left:0;width:100%;height:100%;transform:rotate(-90deg)">
            <circle cx="100" cy="100" r="90" fill="none" stroke="#f2f4f6" stroke-width="6"/>
            <circle id="timer-ring" cx="100" cy="100" r="90" fill="none" stroke="#777491" stroke-width="6"
              stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
              style="transition:stroke-dashoffset 1s linear"/>
          </svg>
          <div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div class="timer-display text-on-background" id="timer-text">${mins}:${secs}</div>
            <p class="text-xs text-on-surface-variant mt-1" id="timer-label">${t.isRunning ? 'Focusing...' : 'Ready'}</p>
          </div>
        </div>

        <!-- Controls -->
        <div class="flex items-center justify-center gap-4 mb-8">
          <button id="btn-timer-reset" onclick="resetTimer()" class="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-background transition-colors">
            <span class="material-symbols-outlined">refresh</span>
          </button>
          <button id="btn-timer-toggle" onclick="toggleTimer()" class="w-20 h-20 rounded-full gradient-aura text-white flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow active:scale-95">
            <span class="material-symbols-outlined" style="font-size:32px" id="timer-icon">${t.isRunning ? 'pause' : 'play_arrow'}</span>
          </button>
          <button id="btn-timer-skip" onclick="skipTimer()" class="w-14 h-14 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant hover:text-on-background transition-colors">
            <span class="material-symbols-outlined">skip_next</span>
          </button>
        </div>

        <!-- Duration Presets -->
        <div class="flex items-center justify-center gap-2 mb-6">
          ${[15, 25, 45, 60].map(m => `
            <button onclick="setTimerDuration(${m})"
              class="px-4 py-2 rounded-full text-xs font-semibold transition-all
              ${Math.round(t.duration / 60) === m
                ? 'gradient-aura text-white'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-background'}">
              ${m}m
            </button>
          `).join('')}
        </div>

        <!-- Stats -->
        <div class="aura-card p-4 max-w-xs mx-auto">
          <div class="flex items-center justify-between">
            <div class="text-center flex-1">
              <p class="text-xl font-bold text-on-background">${state.timer.totalFocusToday}</p>
              <p class="text-[10px] uppercase tracking-widest text-on-surface-variant mt-0.5">min today</p>
            </div>
            <div class="w-px h-10 bg-surface-container-high"></div>
            <div class="text-center flex-1">
              <p class="text-xl font-bold text-on-background">${state.user.totalFocusMinutes}</p>
              <p class="text-[10px] uppercase tracking-widest text-on-surface-variant mt-0.5">total min</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // If timer was running, resume
  if (t.isRunning) startTimerInterval();
}

function toggleTimer() {
  if (timerInterval) {
    // Pause
    clearInterval(timerInterval);
    timerInterval = null;
    state.timer.isRunning = false;
    api('/api/timer', 'PUT', { isRunning: false, remaining: timerSeconds });
    updateTimerUI();
    $focusBadge.classList.add('hidden');
  } else {
    // Start
    state.timer.isRunning = true;
    api('/api/timer', 'PUT', { isRunning: true, remaining: timerSeconds });
    startTimerInterval();
    $focusBadge.classList.remove('hidden');
  }
}

function startTimerInterval() {
  const totalDuration = state.timer.duration;
  const circumference = 2 * Math.PI * 90;

  timerInterval = setInterval(() => {
    timerSeconds--;
    if (timerSeconds <= 0) {
      timerSeconds = 0;
      clearInterval(timerInterval);
      timerInterval = null;
      state.timer.isRunning = false;
      $focusBadge.classList.add('hidden');
      completeTimerSession();
      return;
    }
    updateTimerUI();

    // Update ring
    const pct = ((totalDuration - timerSeconds) / totalDuration) * 100;
    const offset = circumference - (pct / 100) * circumference;
    const ring = document.getElementById('timer-ring');
    if (ring) ring.setAttribute('stroke-dashoffset', offset);
  }, 1000);

  updateTimerUI();
}

function updateTimerUI() {
  const el = document.getElementById('timer-text');
  const icon = document.getElementById('timer-icon');
  const label = document.getElementById('timer-label');
  if (!el) return;

  const mins = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
  const secs = (timerSeconds % 60).toString().padStart(2, '0');
  el.textContent = `${mins}:${secs}`;
  if (icon) icon.textContent = timerInterval ? 'pause' : 'play_arrow';
  if (label) label.textContent = timerInterval ? 'Focusing...' : 'Paused';
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = state.timer.duration;
  state.timer.remaining = state.timer.duration;
  state.timer.isRunning = false;
  api('/api/timer', 'PUT', { remaining: state.timer.duration, isRunning: false });
  $focusBadge.classList.add('hidden');
  renderTimer();
}

async function setTimerDuration(minutes) {
  clearInterval(timerInterval);
  timerInterval = null;
  const duration = minutes * 60;
  state.timer.duration = duration;
  state.timer.remaining = duration;
  state.timer.isRunning = false;
  timerSeconds = duration;
  await api('/api/timer', 'PUT', { duration, remaining: duration, isRunning: false, customMinutes: minutes });
  $focusBadge.classList.add('hidden');
  renderTimer();
}

async function skipTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  $focusBadge.classList.add('hidden');
  await completeTimerSession();
}

async function completeTimerSession() {
  try {
    const data = await api('/api/timer/complete', 'POST');
    state.user = data.user;
    state.timer = data.timer;
    showToast(`Focus complete! +${data.xpEarned} XP`, 'emoji_events');
    renderTimer();
  } catch (e) {
    showToast('Error completing session', 'error');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  FRIENDS VIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function renderFriends() {
  const friends = state.friends || [];

  // Fetch usertag and friend requests
  let usertag = state.user.usertag || '';
  let sentRequests = [];
  let receivedRequests = [];
  
  try {
    if (!usertag) {
      const tagRes = await fetch('/api/user/usertag');
      const tagData = await tagRes.json();
      usertag = tagData.usertag;
      state.user.usertag = usertag;
    }
    
    const [sentRes, receivedRes] = await Promise.all([
      fetch('/api/friends/requests/sent'),
      fetch('/api/friends/requests/received')
    ]);
    sentRequests = await sentRes.json();
    receivedRequests = await receivedRes.json();
  } catch (e) {
    console.error('Error fetching friend data:', e);
  }

  // Sort by level descending
  const sorted = [...friends].sort((a, b) => b.level - a.level);

  $app.innerHTML = `
    <div class="fade-in">
      <div class="mb-6">
        <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-1">Community</p>
        <h2 class="text-3xl font-bold text-on-background">Friends</h2>
        <p class="text-sm text-on-surface-variant mt-2">${friends.length} friend${friends.length !== 1 ? 's' : ''}</p>
      </div>

      <!-- Your Card with Usertag -->
      <div class="aura-card gradient-aura p-4 mb-4">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            ${state.user.profileImage
              ? `<img src="${state.user.profileImage}" class="w-12 h-12 rounded-full object-cover"/>`
              : `<span class="text-white font-bold text-lg">${getInitials(state.user.name)}</span>`}
          </div>
          <div class="flex-1 text-white min-w-0">
            <p class="font-bold text-sm">${state.user.name}</p>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs text-white/80 bg-white/10 px-2 py-0.5 rounded-full cursor-pointer hover:bg-white/20 transition-colors"
                    onclick="copyUsertag('${usertag}')" title="Click to copy">
                ${usertag}
              </span>
              <span class="text-[10px] text-white/50">Click to copy</span>
            </div>
            <p class="text-xs text-white/70 mt-1">Level ${state.user.level} · 🔥 ${state.user.streak}d streak</p>
          </div>
        </div>
      </div>

      <!-- Add Friend by Usertag -->
      <div class="aura-card p-4 mb-4">
        <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-3">Send Friend Request</p>
        <form id="send-friend-request-form" class="flex gap-2">
          <input type="text" id="friend-usertag" class="aura-input flex-1" placeholder="Enter usertag (e.g. user#1234)" required/>
          <button type="submit" class="px-5 py-2.5 rounded-xl font-semibold text-xs gradient-aura text-white transition-all hover:shadow-lg active:scale-95 shrink-0">
            <span class="material-symbols-outlined align-middle" style="font-size:16px">send</span>
          </button>
        </form>
      </div>

      ${receivedRequests.length > 0 ? `
        <!-- Received Friend Requests -->
        <div class="mb-4">
          <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-3">Friend Requests (${receivedRequests.length})</p>
          <div class="space-y-2">
            ${receivedRequests.map(req => `
              <div class="aura-card p-3 flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
                  <span class="font-bold text-primary">${getInitials(req.name || req.usertag.split('#')[0])}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-sm text-on-background">${req.name || req.usertag.split('#')[0]}</p>
                  <p class="text-[10px] text-on-surface-variant">${req.usertag}</p>
                </div>
                <div class="flex gap-2">
                  <button onclick="acceptFriendRequest('${req.id}')" 
                          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white hover:bg-primary-dim transition-colors">
                    Accept
                  </button>
                  <button onclick="declineFriendRequest('${req.id}')"
                          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-container-high text-on-surface-variant hover:bg-surface-container transition-colors">
                    Decline
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${sentRequests.length > 0 ? `
        <!-- Sent Friend Requests -->
        <div class="mb-4">
          <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-3">Pending Requests (${sentRequests.length})</p>
          <div class="space-y-2">
            ${sentRequests.map(req => `
              <div class="aura-card p-3 flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
                  <span class="material-symbols-outlined text-on-surface-variant" style="font-size:20px">hourglass_empty</span>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-sm text-on-background">${req.usertag}</p>
                  <p class="text-[10px] text-on-surface-variant">Sent ${formatTimeAgo(req.sentAt)}</p>
                </div>
                <button onclick="cancelFriendRequest('${req.id}')"
                        class="px-3 py-1.5 rounded-lg text-xs font-semibold text-error bg-error/5 hover:bg-error/10 transition-colors">
                  Cancel
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Friends List -->
      <div class="mb-4">
        <p class="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-3">Your Friends</p>
        <div class="stagger-children space-y-3" id="friends-list">
          ${sorted.length === 0 ? `
            <div class="text-center py-12 text-on-surface-variant">
              <span class="material-symbols-outlined text-5xl mb-3 block opacity-30">group_add</span>
              <p class="font-medium">No friends yet</p>
              <p class="text-sm mt-1">Send a friend request using their usertag</p>
            </div>
          ` : sorted.map((f, i) => friendCard(f, i)).join('')}
        </div>
      </div>
    </div>
  `;

  // Send friend request form handler
  document.getElementById('send-friend-request-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('friend-usertag');
    const usertag = input.value.trim();
    if (!usertag) return;

    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usertag })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to send request', 'error');
        return;
      }
      showToast('Friend request sent!', 'send');
      input.value = '';
      renderFriends();
    } catch (err) {
      showToast('Failed to send friend request', 'error');
    }
  });
}

// Copy usertag to clipboard
function copyUsertag(usertag) {
  navigator.clipboard.writeText(usertag).then(() => {
    showToast('Usertag copied!', 'content_copy');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

// Format time ago helper
function formatTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'just now';
}

// Accept friend request
async function acceptFriendRequest(requestId) {
  try {
    const res = await fetch(`/api/friends/request/${requestId}/accept`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error || 'Failed to accept request', 'error');
      return;
    }
    state.friends.push(data.friend);
    showToast('Friend request accepted!', 'person_add');
    renderFriends();
  } catch (err) {
    showToast('Failed to accept request', 'error');
  }
}

// Decline friend request
async function declineFriendRequest(requestId) {
  try {
    await fetch(`/api/friends/request/${requestId}/decline`, { method: 'POST' });
    showToast('Friend request declined', 'person_remove');
    renderFriends();
  } catch (err) {
    showToast('Failed to decline request', 'error');
  }
}

// Cancel sent friend request
async function cancelFriendRequest(requestId) {
  try {
    await fetch(`/api/friends/request/${requestId}`, { method: 'DELETE' });
    showToast('Friend request cancelled', 'undo');
    renderFriends();
  } catch (err) {
    showToast('Failed to cancel request', 'error');
  }
}

function friendCard(f, rank) {
  const xpPct = f.xpToNext > 0 ? Math.round((f.xp / f.xpToNext) * 100) : 0;

  // Rank medal
  const medals = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];
  const medal = rank < 3 ? medals[rank] : '';

  return `
    <div class="aura-card aura-glow p-4 cursor-pointer transition-all hover:shadow-md"
         onclick="openFriendProfile('${f.id}')" id="friend-${f.id}">
      <div class="flex items-center gap-4">
        <div class="relative shrink-0">
          <div class="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden">
            ${f.profileImage
              ? `<img src="${f.profileImage}" class="w-12 h-12 object-cover"/>`
              : `<span class="font-bold text-primary text-lg">${getInitials(f.name)}</span>`}
          </div>
          ${medal ? `<span class="absolute -top-1 -right-1 text-sm">${medal}</span>` : ''}
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <p class="font-semibold text-sm text-on-background truncate">${f.name}</p>
          </div>
          <p class="text-[10px] text-on-surface-variant">${f.usertag || '@' + f.username}</p>
          <div class="flex items-center gap-3 mt-1">
            <span class="text-xs text-on-surface-variant">Lv.${f.level}</span>
            <span class="text-xs text-on-surface-variant">🔥 ${f.streak}d</span>
            <span class="text-xs text-on-surface-variant">✅ ${f.habitsCompleted}</span>
          </div>
          <div class="progress-bar mt-2" style="height:4px">
            <div class="progress-bar-fill" style="width:${xpPct}%"></div>
          </div>
        </div>
        <div class="shrink-0 text-right">
          <span class="material-symbols-outlined text-on-surface-variant/50" style="font-size:18px">chevron_right</span>
        </div>
      </div>
    </div>
  `;
}

function openFriendProfile(friendId) {
  const f = (state.friends || []).find(fr => fr.id === friendId);
  if (!f) return;

  const xpPct = f.xpToNext > 0 ? Math.round((f.xp / f.xpToNext) * 100) : 0;
  const circumference = 2 * Math.PI * 40;
  const ringOffset = circumference - (xpPct / 100) * circumference;

  openModal(`
    <div>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-bold text-on-background">Friend Profile</h3>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-background transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Profile Header -->
      <div class="text-center mb-6">
        <div class="mx-auto mb-3 relative" style="width:96px;height:96px">
          <svg viewBox="0 0 96 96" style="width:96px;height:96px;transform:rotate(-90deg);position:absolute;top:0;left:0">
            <circle cx="48" cy="48" r="40" fill="none" stroke="#f2f4f6" stroke-width="4"/>
            <circle cx="48" cy="48" r="40" fill="none" stroke="#777491" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${ringOffset}"
              style="transition:stroke-dashoffset 0.8s ease"/>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden">
              ${f.profileImage
                ? `<img src="${f.profileImage}" class="w-16 h-16 object-cover"/>`
                : `<span class="font-bold text-primary text-2xl">${getInitials(f.name)}</span>`}
            </div>
          </div>
        </div>
        <p class="text-lg font-bold text-on-background">${f.name}</p>
        <p class="text-xs text-on-surface-variant bg-surface-container-high inline-block px-2 py-0.5 rounded-full mt-1">${f.usertag || '@' + f.username}</p>
        <p class="text-sm text-primary font-semibold mt-2">Level ${f.level}</p>
        <p class="text-[10px] text-on-surface-variant mt-0.5">${f.xp} / ${f.xpToNext} XP</p>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 gap-3 mb-6">
        <div class="aura-card p-4 text-center" style="background:#f9f9fb">
          <p class="text-2xl font-bold text-on-background">🔥 ${f.streak}</p>
          <p class="text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">Day Streak</p>
        </div>
        <div class="aura-card p-4 text-center" style="background:#f9f9fb">
          <p class="text-2xl font-bold text-on-background">⏱ ${f.totalFocusMinutes}</p>
          <p class="text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">Focus Min</p>
        </div>
        <div class="aura-card p-4 text-center" style="background:#f9f9fb">
          <p class="text-2xl font-bold text-on-background">✅ ${f.habitsCompleted}</p>
          <p class="text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">Habits Done</p>
        </div>
        <div class="aura-card p-4 text-center" style="background:#f9f9fb">
          <p class="text-2xl font-bold text-on-background">🚩 ${f.questsCompleted}</p>
          <p class="text-[10px] uppercase tracking-widest text-on-surface-variant mt-1">Quests Done</p>
        </div>
      </div>

      <!-- Remove Friend -->
      <button onclick="removeFriend('${f.id}')"
              class="w-full py-2.5 rounded-xl text-xs font-semibold text-error bg-error/5 hover:bg-error/10 transition-colors">
        Remove Friend
      </button>
    </div>
  `);
}

async function removeFriend(friendId) {
  if (!confirm('Remove this friend?')) return;
  await api(`/api/friends/${friendId}`, 'DELETE');
  state.friends = state.friends.filter(f => f.id !== friendId);
  closeModal();
  showToast('Friend removed', 'person_remove');
  renderFriends();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PROFILE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function updateHeaderAvatar() {
  const $img = document.getElementById('header-avatar');
  const $initials = document.getElementById('header-avatar-initials');
  if (state.user.profileImage) {
    $img.src = state.user.profileImage;
    $img.alt = state.user.name;
    $img.classList.remove('hidden');
    $initials.classList.add('hidden');
  } else {
    $img.classList.add('hidden');
    $initials.classList.remove('hidden');
  }
}

function openProfileModal() {
  const u = state.user;
  const hasImage = !!u.profileImage;

  openModal(`
    <div>
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-bold text-on-background">Profile Settings</h3>
        <button onclick="closeModal()" class="text-on-surface-variant hover:text-on-background transition-colors">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Avatar Upload -->
      <div class="mb-6">
        <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-3 block text-center">Profile Photo</label>
        <div class="profile-upload-zone" id="avatar-upload-zone" onclick="document.getElementById('avatar-file-input').click()">
          ${hasImage ? `<img src="${u.profileImage}" alt="Profile" id="avatar-preview-img"/>` : ''}
          <div class="upload-overlay">
            <span class="material-symbols-outlined text-white" style="font-size:28px">photo_camera</span>
          </div>
          ${!hasImage ? `
            <span class="material-symbols-outlined text-on-surface-variant/40" style="font-size:36px">add_a_photo</span>
            <span class="text-[10px] text-on-surface-variant mt-1">Upload Photo</span>
          ` : ''}
        </div>
        <input type="file" id="avatar-file-input" accept="image/*" class="hidden" onchange="handleAvatarUpload(event)"/>
        ${hasImage ? `
          <button onclick="removeAvatar()" class="text-xs text-error hover:underline mt-3 block mx-auto">Remove Photo</button>
        ` : ''}
      </div>

      <!-- Usertag Display -->
      ${u.usertag ? `
        <div class="mb-4 text-center">
          <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Your Usertag</label>
          <div class="inline-flex items-center gap-2 bg-surface-container-high px-4 py-2 rounded-xl cursor-pointer hover:bg-surface-container transition-colors"
               onclick="copyUsertag('${u.usertag}')">
            <span class="font-semibold text-primary">${u.usertag}</span>
            <span class="material-symbols-outlined text-on-surface-variant" style="font-size:16px">content_copy</span>
          </div>
          <p class="text-[10px] text-on-surface-variant mt-1">Share this with friends so they can add you</p>
        </div>
      ` : ''}

      <!-- Name & Username -->
      <form id="profile-form" class="space-y-4">
        <div>
          <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Display Name</label>
          <input type="text" name="name" class="aura-input" value="${u.name}" required/>
        </div>
        <div>
          <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Username</label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">@</span>
            <input type="text" name="username" class="aura-input" style="padding-left:1.75rem" value="${u.username || ''}" placeholder="your_username" required/>
          </div>
          <p class="text-[10px] text-on-surface-variant mt-1">Your usertag will be username + unique number</p>
        </div>
        <div>
          <label class="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2 block">Daily XP Goal</label>
          <input type="number" name="dailyXpGoal" class="aura-input" value="${u.dailyXpGoal}" min="500" max="20000" step="500"/>
        </div>
        <button type="submit" class="w-full py-3.5 rounded-xl font-semibold text-sm gradient-aura text-white transition-all hover:shadow-lg active:scale-[0.98]">
          Save Changes
        </button>
      </form>

      <!-- Danger Zone -->
      <div class="mt-6 pt-4 border-t border-surface-container-high space-y-2">
        <button onclick="logout()" 
                class="w-full py-2.5 rounded-xl text-xs font-semibold text-on-surface-variant bg-surface-container-high hover:bg-surface-container transition-colors">
          Log Out
        </button>
        <button onclick="if(confirm('Reset all data? This cannot be undone.')){resetAllData()}" 
                class="w-full py-2.5 rounded-xl text-xs font-semibold text-error bg-error/5 hover:bg-error/10 transition-colors">
          Reset All Data
        </button>
      </div>
    </div>
  `);

  // Form submit
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd);
    body.dailyXpGoal = parseInt(body.dailyXpGoal);
    state.user = await api('/api/user', 'PUT', body);
    updateHeaderAvatar();
    closeModal();
    showToast('Profile updated!', 'person');
    renderView(currentView);
  });
}

// Logout function
async function logout() {
  try {
    await api('/api/auth/logout', 'POST');
  } catch (e) {
    // Ignore errors
  }
  window.location.href = '/login.html';
}

async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate size (max 2MB)
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image too large (max 2MB)', 'error');
    return;
  }

  // Read, resize, and upload as base64
  const reader = new FileReader();
  reader.onload = async (e) => {
    const img = new Image();
    img.onload = async () => {
      // Resize to 200x200 to keep DB small
      const canvas = document.createElement('canvas');
      const size = 200;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Crop center square
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      try {
        const data = await api('/api/user/avatar', 'POST', { image: dataUrl });
        state.user.profileImage = data.profileImage;
        updateHeaderAvatar();
        showToast('Profile photo updated!', 'photo_camera');
        // Re-open modal to show new image
        openProfileModal();
      } catch (err) {
        showToast('Failed to upload photo', 'error');
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function removeAvatar() {
  await api('/api/user/avatar', 'DELETE');
  state.user.profileImage = null;
  updateHeaderAvatar();
  showToast('Photo removed', 'delete');
  openProfileModal();
}

async function resetAllData() {
  await api('/api/reset', 'POST');
  await loadState();
  updateHeaderAvatar();
  closeModal();
  showToast('Data reset!', 'refresh');
  renderView(currentView);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// ─── Boot ───
init();
