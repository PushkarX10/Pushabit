const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// ─── Middleware ───
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── Database Helpers ───
function genId() { return crypto.randomUUID(); }

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch { return null; }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getDayOfWeek() {
  return new Date().getDay(); // 0=Sun, 1=Mon...6=Sat
}

function createDefaultDB() {
  return {
    user: {
      name: "Ethereal Editor",
      username: "ethereal",
      level: 1,
      xp: 0,
      xpToNext: 1000,
      streak: 0,
      lastActiveDate: null,
      dailyXpGoal: 4000,
      dailyXpEarned: 0,
      totalFocusMinutes: 0,
      profileImage: null
    },
    habits: [
      {
        id: genId(),
        title: "Morning Meditation",
        description: "Start your day with 15 minutes of mindfulness meditation",
        category: "mental",
        icon: "self_improvement",
        xpReward: 150,
        tier: 1,
        completedDates: [],
        createdAt: new Date().toISOString()
      },
      {
        id: genId(),
        title: "Deep Reading",
        description: "Read without distractions for 30 minutes",
        category: "mental",
        icon: "auto_stories",
        xpReward: 200,
        tier: 2,
        completedDates: [],
        createdAt: new Date().toISOString()
      },
      {
        id: genId(),
        title: "Evening Workout",
        description: "45-minute physical exercise routine",
        category: "physical",
        icon: "fitness_center",
        xpReward: 250,
        tier: 1,
        completedDates: [],
        createdAt: new Date().toISOString()
      }
    ],
    quests: [
      {
        id: genId(),
        title: "4-Hour Focused Work",
        description: "Complete 4 hours of deep focused work to master the art of concentration. This challenge tests your ability to sustain attention over extended periods.",
        category: "Productivity",
        difficulty: "Advanced",
        xpReward: 400,
        lootReward: "Rare Gem",
        objectives: [
          { id: genId(), title: "Complete Morning Focus Session", description: "1 hour of focused work before noon", completed: false },
          { id: genId(), title: "Afternoon Deep Work Block", description: "2 hours of uninterrupted afternoon session", completed: false },
          { id: genId(), title: "Evening Review & Planning", description: "1 hour of focused review and next-day planning", completed: false }
        ],
        active: true,
        completed: false,
        createdAt: new Date().toISOString()
      },
      {
        id: genId(),
        title: "Curate Design System",
        description: "Build a comprehensive personal design system for your creative workflow. Document patterns, create templates, and establish a consistent visual language.",
        category: "Creative",
        difficulty: "Intermediate",
        xpReward: 250,
        lootReward: null,
        objectives: [
          { id: genId(), title: "Define Color Palette", description: "Choose and document a harmonious color system", completed: false },
          { id: genId(), title: "Create Typography Scale", description: "Establish font sizes, weights, and line heights", completed: false },
          { id: genId(), title: "Build Component Library", description: "Design reusable UI components", completed: false }
        ],
        active: true,
        completed: false,
        createdAt: new Date().toISOString()
      }
    ],
    skills: {
      focusClarity: 0,
      agility: 0,
      intuition: 0,
      stability: 0
    },
    inventory: [
      { id: "item1", name: "Bronze Medal", icon: "military_tech", unlocked: true },
      { id: "item2", name: "Sapphire", icon: "diamond", unlocked: false },
      { id: "item3", name: "Star Dust", icon: "auto_awesome", unlocked: false },
      { id: "item4", name: "Shield Emblem", icon: "shield", unlocked: false },
      { id: "item5", name: "Crown", icon: "workspace_premium", unlocked: false },
      { id: "item6", name: "Flame Core", icon: "local_fire_department", unlocked: false }
    ],
    timer: {
      duration: 25 * 60,
      remaining: 25 * 60,
      isRunning: false,
      totalFocusToday: 0,
      customMinutes: 25
    },
    weeklyGrowth: [0, 0, 0, 0, 0, 0, 0],
    lootProgress: 0,
    lootTarget: 4,
    friends: [
      {
        id: genId(),
        username: "alex_storm",
        name: "Alex Storm",
        profileImage: null,
        level: 7,
        xp: 850,
        xpToNext: 2400,
        streak: 12,
        totalFocusMinutes: 480,
        habitsCompleted: 42,
        questsCompleted: 8,
        addedAt: new Date().toISOString()
      },
      {
        id: genId(),
        username: "maya_flow",
        name: "Maya Flow",
        profileImage: null,
        level: 4,
        xp: 320,
        xpToNext: 1560,
        streak: 5,
        totalFocusMinutes: 210,
        habitsCompleted: 23,
        questsCompleted: 3,
        addedAt: new Date().toISOString()
      },
      {
        id: genId(),
        username: "kai_zenith",
        name: "Kai Zenith",
        profileImage: null,
        level: 11,
        xp: 1200,
        xpToNext: 3600,
        streak: 30,
        totalFocusMinutes: 1200,
        habitsCompleted: 95,
        questsCompleted: 15,
        addedAt: new Date().toISOString()
      }
    ]
  };
}

// ─── Initialize DB ───
function initDB() {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  if (!readDB()) {
    writeDB(createDefaultDB());
  }
  // Reset daily counters if new day
  const db = readDB();
  const today = getToday();
  if (db.user.lastActiveDate !== today) {
    db.user.dailyXpEarned = 0;
    db.timer.totalFocusToday = 0;
    db.timer.remaining = db.timer.duration;
    db.timer.isRunning = false;
    // Update streak
    if (db.user.lastActiveDate) {
      const last = new Date(db.user.lastActiveDate);
      const now = new Date(today);
      const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        db.user.streak = 0; // streak broken
      }
    }
    writeDB(db);
  }
}

initDB();

// ━━━━━━ API ROUTES ━━━━━━

// ─── Auth ───
app.post('/api/auth/register', (req, res) => {
  const db = readDB();
  const { name, username, email, password } = req.body;
  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  
  // Generate a unique usertag (username + random 4-digit number)
  const usertag = username.toLowerCase().replace(/\s+/g, '_') + '#' + Math.floor(1000 + Math.random() * 9000);
  
  // Registering overwrites the current local single-user profile cleanly
  db.user = {
    ...db.user,
    name,
    username,
    usertag,
    email,
    password,
    level: 1,
    xp: 0,
    streak: 0,
    dailyXpEarned: 0,
    totalFocusMinutes: 0
  };
  // Set session as logged in
  db.session = { loggedIn: true, loginTime: new Date().toISOString() };
  // Initialize friend requests array if not exists
  if (!db.friendRequests) db.friendRequests = [];
  if (!db.sentRequests) db.sentRequests = [];
  writeDB(db);
  // Use Buffer for base64 encoding (Node.js compatible)
  res.json({ message: 'Registration successful', token: Buffer.from(db.user.username).toString('base64'), usertag });
});

app.post('/api/auth/login', (req, res) => {
  const db = readDB();
  const { email, password, identifier } = req.body; 
  
  // Support both 'email' and 'identifier' fields for flexibility
  const loginId = email || identifier;

  const isIdentifierValid = db.user && (db.user.username === loginId || db.user.email === loginId);
  
  if (isIdentifierValid && db.user.password === password) {
    // Set session as logged in
    db.session = { loggedIn: true, loginTime: new Date().toISOString() };
    writeDB(db);
    res.json({ message: 'Login successful', user: { name: db.user.name, username: db.user.username } });
  } else {
    res.status(401).json({ error: 'Invalid credentials. If this is your first time, create an account.' });
  }
});

// Auth check - for login page to verify if already authenticated
// Uses session tracking via db.session
app.get('/api/auth/check', (req, res) => {
  const db = readDB();
  // Check if user has an active session
  if (db.session && db.session.loggedIn && db.user && db.user.email) {
    res.json({ authenticated: true, user: { name: db.user.name, username: db.user.username } });
  } else {
    res.json({ authenticated: false });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const db = readDB();
  db.session = { loggedIn: false };
  writeDB(db);
  res.json({ message: 'Logged out successfully' });
});

// ─── User ───
app.get('/api/user', (req, res) => {
  const db = readDB();
  // Exclude password from response for security
  const { password, ...safeUser } = db.user;
  res.json(safeUser);
});

app.put('/api/user', (req, res) => {
  const db = readDB();
  // Prevent password from being updated via this endpoint
  const { password, ...updates } = req.body;
  Object.assign(db.user, updates);
  writeDB(db);
  // Exclude password from response
  const { password: pwd, ...safeUser } = db.user;
  res.json(safeUser);
});

// ─── Habits ───
app.get('/api/habits', (req, res) => {
  const db = readDB();
  const today = getToday();
  const habits = db.habits.map(h => ({
    ...h,
    completedToday: h.completedDates.includes(today),
    currentStreak: calculateStreak(h.completedDates)
  }));
  res.json(habits);
});

app.post('/api/habits', (req, res) => {
  const db = readDB();
  const habit = {
    id: genId(),
    title: req.body.title,
    description: req.body.description || '',
    category: req.body.category || 'mental',
    icon: req.body.icon || 'check_circle',
    xpReward: parseInt(req.body.xpReward) || 100,
    tier: 1,
    completedDates: [],
    createdAt: new Date().toISOString()
  };
  db.habits.push(habit);
  writeDB(db);
  res.json(habit);
});

app.put('/api/habits/:id', (req, res) => {
  const db = readDB();
  const idx = db.habits.findIndex(h => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Habit not found' });
  Object.assign(db.habits[idx], req.body);
  writeDB(db);
  res.json(db.habits[idx]);
});

app.delete('/api/habits/:id', (req, res) => {
  const db = readDB();
  db.habits = db.habits.filter(h => h.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/habits/:id/toggle', (req, res) => {
  const db = readDB();
  const habit = db.habits.find(h => h.id === req.params.id);
  if (!habit) return res.status(404).json({ error: 'Habit not found' });

  const today = getToday();
  const idx = habit.completedDates.indexOf(today);

  if (idx === -1) {
    // Complete
    habit.completedDates.push(today);
    db.user.xp += habit.xpReward;
    db.user.dailyXpEarned += habit.xpReward;
    // Track weekly growth
    const dow = getDayOfWeek();
    db.weeklyGrowth[dow] += habit.xpReward;
    // Update streak
    db.user.lastActiveDate = today;
    if (db.user.streak === 0) db.user.streak = 1;
    // Tier up every 7 completions
    if (habit.completedDates.length % 7 === 0) {
      habit.tier = Math.min(habit.tier + 1, 5);
    }
    // Level up check
    while (db.user.xp >= db.user.xpToNext) {
      db.user.xp -= db.user.xpToNext;
      db.user.level++;
      db.user.xpToNext = Math.floor(db.user.xpToNext * 1.25);
      // Unlock inventory item on level up
      const locked = db.inventory.find(i => !i.unlocked);
      if (locked) locked.unlocked = true;
    }
    // Update skills based on category
    updateSkillsFromHabit(db, habit.category);
  } else {
    // Un-complete
    habit.completedDates.splice(idx, 1);
    db.user.xp = Math.max(0, db.user.xp - habit.xpReward);
    db.user.dailyXpEarned = Math.max(0, db.user.dailyXpEarned - habit.xpReward);
    const dow = getDayOfWeek();
    db.weeklyGrowth[dow] = Math.max(0, db.weeklyGrowth[dow] - habit.xpReward);
  }

  // Calculate efficiency
  const totalPossibleXp = db.habits.reduce((sum, h) => sum + h.xpReward, 0);
  const earnedToday = db.habits.reduce((sum, h) => {
    return sum + (h.completedDates.includes(today) ? h.xpReward : 0);
  }, 0);
  db.user.efficiency = totalPossibleXp > 0 ? Math.round((earnedToday / totalPossibleXp) * 100) : 0;

  writeDB(db);
  res.json({
    habit: { ...habit, completedToday: habit.completedDates.includes(today), currentStreak: calculateStreak(habit.completedDates) },
    user: db.user
  });
});

// ─── Quests ───
app.get('/api/quests', (req, res) => {
  const db = readDB();
  res.json(db.quests);
});

app.post('/api/quests', (req, res) => {
  const db = readDB();
  const quest = {
    id: genId(),
    title: req.body.title,
    description: req.body.description || '',
    category: req.body.category || 'General',
    difficulty: req.body.difficulty || 'Beginner',
    xpReward: parseInt(req.body.xpReward) || 200,
    lootReward: req.body.lootReward || null,
    objectives: (req.body.objectives || []).map(o => ({ id: genId(), title: o.title, description: o.description || '', completed: false })),
    active: true,
    completed: false,
    createdAt: new Date().toISOString()
  };
  db.quests.push(quest);
  writeDB(db);
  res.json(quest);
});

app.get('/api/quests/:id', (req, res) => {
  const db = readDB();
  const quest = db.quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  res.json(quest);
});

app.delete('/api/quests/:id', (req, res) => {
  const db = readDB();
  db.quests = db.quests.filter(q => q.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/quests/:id/objectives/:objId/toggle', (req, res) => {
  const db = readDB();
  const quest = db.quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });

  const obj = quest.objectives.find(o => o.id === req.params.objId);
  if (!obj) return res.status(404).json({ error: 'Objective not found' });

  obj.completed = !obj.completed;
  writeDB(db);
  res.json(quest);
});

app.post('/api/quests/:id/complete', (req, res) => {
  const db = readDB();
  const quest = db.quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });

  quest.completed = true;
  quest.active = false;
  db.user.xp += quest.xpReward;
  db.user.dailyXpEarned += quest.xpReward;

  const dow = getDayOfWeek();
  db.weeklyGrowth[dow] += quest.xpReward;
  db.user.lastActiveDate = getToday();

  // Level up check
  while (db.user.xp >= db.user.xpToNext) {
    db.user.xp -= db.user.xpToNext;
    db.user.level++;
    db.user.xpToNext = Math.floor(db.user.xpToNext * 1.25);
    const locked = db.inventory.find(i => !i.unlocked);
    if (locked) locked.unlocked = true;
  }

  writeDB(db);
  res.json({ quest, user: db.user });
});

// ─── Skills ───
app.get('/api/skills', (req, res) => {
  const db = readDB();
  res.json(db.skills);
});

app.post('/api/skills/evolve', (req, res) => {
  const db = readDB();
  const cost = 500;
  if (db.user.xp < cost) return res.status(400).json({ error: 'Not enough XP' });

  db.user.xp -= cost;
  const { skill } = req.body; // which skill to boost
  if (db.skills[skill] !== undefined) {
    db.skills[skill] = Math.min(100, db.skills[skill] + 10);
  }
  writeDB(db);
  res.json({ skills: db.skills, user: db.user });
});

// ─── Timer ───
app.get('/api/timer', (req, res) => {
  const db = readDB();
  res.json(db.timer);
});

app.put('/api/timer', (req, res) => {
  const db = readDB();
  Object.assign(db.timer, req.body);
  writeDB(db);
  res.json(db.timer);
});

app.post('/api/timer/complete', (req, res) => {
  const db = readDB();
  const minutesCompleted = Math.round(db.timer.duration / 60);
  db.timer.totalFocusToday += minutesCompleted;
  db.user.totalFocusMinutes += minutesCompleted;
  db.timer.remaining = db.timer.duration;
  db.timer.isRunning = false;

  // Award XP for focus session
  const xpEarned = minutesCompleted * 4;
  db.user.xp += xpEarned;
  db.user.dailyXpEarned += xpEarned;
  db.user.lastActiveDate = getToday();

  const dow = getDayOfWeek();
  db.weeklyGrowth[dow] += xpEarned;

  // Loot progress (based on hours)
  db.lootProgress = Math.min(db.lootTarget, db.timer.totalFocusToday / 60);
  if (db.lootProgress >= db.lootTarget) {
    const locked = db.inventory.find(i => !i.unlocked);
    if (locked) locked.unlocked = true;
    db.lootProgress = 0;
  }

  // Level up
  while (db.user.xp >= db.user.xpToNext) {
    db.user.xp -= db.user.xpToNext;
    db.user.level++;
    db.user.xpToNext = Math.floor(db.user.xpToNext * 1.25);
  }

  // Update skills
  db.skills.focusClarity = Math.min(100, db.skills.focusClarity + 2);
  db.skills.stability = Math.min(100, db.skills.stability + 1);

  writeDB(db);
  res.json({ timer: db.timer, user: db.user, xpEarned });
});

// ─── Profile Image Upload ───
app.post('/api/user/avatar', (req, res) => {
  const db = readDB();
  const { image } = req.body; // base64 data URI
  if (!image) return res.status(400).json({ error: 'No image provided' });
  db.user.profileImage = image;
  writeDB(db);
  res.json({ profileImage: db.user.profileImage });
});

app.delete('/api/user/avatar', (req, res) => {
  const db = readDB();
  db.user.profileImage = null;
  writeDB(db);
  res.json({ success: true });
});

// ─── Friends ───
app.get('/api/friends', (req, res) => {
  const db = readDB();
  res.json(db.friends || []);
});

// Get current user's usertag
app.get('/api/user/usertag', (req, res) => {
  const db = readDB();
  if (db.user && db.user.usertag) {
    res.json({ usertag: db.user.usertag });
  } else {
    // Generate usertag if not exists
    const usertag = (db.user.username || 'user').toLowerCase().replace(/\s+/g, '_') + '#' + Math.floor(1000 + Math.random() * 9000);
    db.user.usertag = usertag;
    writeDB(db);
    res.json({ usertag });
  }
});

// Send friend request by usertag
app.post('/api/friends/request', (req, res) => {
  const db = readDB();
  const { usertag } = req.body;
  
  if (!usertag || !usertag.trim()) {
    return res.status(400).json({ error: 'Usertag is required' });
  }
  
  const cleanUsertag = usertag.trim().toLowerCase();
  
  // Check if it's own usertag
  if (db.user.usertag && db.user.usertag.toLowerCase() === cleanUsertag) {
    return res.status(400).json({ error: "You can't send a friend request to yourself" });
  }
  
  // Initialize arrays if needed
  if (!db.friendRequests) db.friendRequests = [];
  if (!db.sentRequests) db.sentRequests = [];
  
  // Check if already sent a request
  if (db.sentRequests.some(r => r.usertag.toLowerCase() === cleanUsertag)) {
    return res.status(400).json({ error: 'Friend request already sent to this user' });
  }
  
  // Check if already friends
  if ((db.friends || []).some(f => f.usertag && f.usertag.toLowerCase() === cleanUsertag)) {
    return res.status(400).json({ error: 'This user is already your friend' });
  }
  
  // Add to sent requests (in a real app, this would go to the other user's DB)
  const request = {
    id: genId(),
    usertag: cleanUsertag,
    sentAt: new Date().toISOString(),
    status: 'pending'
  };
  db.sentRequests.push(request);
  writeDB(db);
  
  res.json({ message: 'Friend request sent!', request });
});

// Get sent friend requests
app.get('/api/friends/requests/sent', (req, res) => {
  const db = readDB();
  res.json(db.sentRequests || []);
});

// Get received friend requests (simulated - in real app would be from other users)
app.get('/api/friends/requests/received', (req, res) => {
  const db = readDB();
  res.json(db.friendRequests || []);
});

// Accept friend request
app.post('/api/friends/request/:id/accept', (req, res) => {
  const db = readDB();
  const requestId = req.params.id;
  
  if (!db.friendRequests) db.friendRequests = [];
  const requestIdx = db.friendRequests.findIndex(r => r.id === requestId);
  
  if (requestIdx === -1) {
    return res.status(404).json({ error: 'Friend request not found' });
  }
  
  const request = db.friendRequests[requestIdx];
  
  // Create friend from request
  const friend = {
    id: genId(),
    username: request.username || request.usertag.split('#')[0],
    usertag: request.usertag,
    name: request.name || request.username || request.usertag.split('#')[0],
    profileImage: null,
    level: 1,
    xp: 0,
    xpToNext: 1000,
    streak: 0,
    totalFocusMinutes: 0,
    habitsCompleted: 0,
    questsCompleted: 0,
    addedAt: new Date().toISOString()
  };
  
  if (!db.friends) db.friends = [];
  db.friends.push(friend);
  
  // Remove from pending requests
  db.friendRequests.splice(requestIdx, 1);
  writeDB(db);
  
  res.json({ message: 'Friend request accepted!', friend });
});

// Decline friend request
app.post('/api/friends/request/:id/decline', (req, res) => {
  const db = readDB();
  const requestId = req.params.id;
  
  if (!db.friendRequests) db.friendRequests = [];
  db.friendRequests = db.friendRequests.filter(r => r.id !== requestId);
  writeDB(db);
  
  res.json({ message: 'Friend request declined' });
});

// Cancel sent friend request
app.delete('/api/friends/request/:id', (req, res) => {
  const db = readDB();
  const requestId = req.params.id;
  
  if (!db.sentRequests) db.sentRequests = [];
  db.sentRequests = db.sentRequests.filter(r => r.id !== requestId);
  writeDB(db);
  
  res.json({ message: 'Friend request cancelled' });
});

app.post('/api/friends/add', (req, res) => {
  const db = readDB();
  const { username, name, usertag } = req.body;
  
  // Support adding by usertag or username
  const identifier = usertag || username;
  if (!identifier || !identifier.trim()) {
    return res.status(400).json({ error: 'Username or usertag is required' });
  }
  
  const cleanIdentifier = identifier.trim().toLowerCase();
  const isUsertag = cleanIdentifier.includes('#');
  
  // Check if already friends
  if ((db.friends || []).some(f => {
    if (isUsertag && f.usertag) {
      return f.usertag.toLowerCase() === cleanIdentifier;
    }
    return f.username.toLowerCase() === cleanIdentifier.replace(/\s+/g, '_');
  })) {
    return res.status(400).json({ error: 'Already in your friends list' });
  }
  
  // Check if adding self
  if (isUsertag && db.user.usertag && db.user.usertag.toLowerCase() === cleanIdentifier) {
    return res.status(400).json({ error: "You can't add yourself" });
  }
  if (!isUsertag && cleanIdentifier === (db.user.username || '').toLowerCase()) {
    return res.status(400).json({ error: "You can't add yourself" });
  }
  
  const cleanUsername = isUsertag ? cleanIdentifier.split('#')[0] : cleanIdentifier.replace(/\s+/g, '_');
  
  const friend = {
    id: genId(),
    username: cleanUsername,
    usertag: isUsertag ? cleanIdentifier : cleanUsername + '#' + Math.floor(1000 + Math.random() * 9000),
    name: name || cleanUsername,
    profileImage: null,
    level: 1,
    xp: 0,
    xpToNext: 1000,
    streak: 0,
    totalFocusMinutes: 0,
    habitsCompleted: 0,
    questsCompleted: 0,
    addedAt: new Date().toISOString()
  };
  
  if (!db.friends) db.friends = [];
  db.friends.push(friend);
  writeDB(db);
  res.json(friend);
});

app.get('/api/friends/:id', (req, res) => {
  const db = readDB();
  const friend = (db.friends || []).find(f => f.id === req.params.id);
  if (!friend) return res.status(404).json({ error: 'Friend not found' });
  res.json(friend);
});

app.delete('/api/friends/:id', (req, res) => {
  const db = readDB();
  db.friends = (db.friends || []).filter(f => f.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// ─── Inventory ───
app.get('/api/inventory', (req, res) => {
  const db = readDB();
  res.json({ items: db.inventory, lootProgress: db.lootProgress, lootTarget: db.lootTarget });
});

// ─── Stats (Weekly Growth) ───
app.get('/api/stats/weekly', (req, res) => {
  const db = readDB();
  res.json(db.weeklyGrowth);
});

// ─── Full State (for initial load) ───
app.get('/api/state', (req, res) => {
  const db = readDB();
  const today = getToday();
  const habits = db.habits.map(h => ({
    ...h,
    completedToday: h.completedDates.includes(today),
    currentStreak: calculateStreak(h.completedDates)
  }));
  res.json({
    user: db.user,
    habits,
    quests: db.quests,
    skills: db.skills,
    timer: db.timer,
    inventory: db.inventory,
    weeklyGrowth: db.weeklyGrowth,
    lootProgress: db.lootProgress,
    lootTarget: db.lootTarget,
    friends: db.friends || []
  });
});

// ─── Reset ───
app.post('/api/reset', (req, res) => {
  writeDB(createDefaultDB());
  res.json({ success: true });
});

// ─── Helpers ───
function calculateStreak(dates) {
  if (!dates.length) return 0;
  const sorted = [...dates].sort().reverse();
  let streak = 0;
  let check = new Date();
  for (const d of sorted) {
    const dateStr = check.toISOString().split('T')[0];
    if (d === dateStr) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      // Check yesterday too (in case today isn't completed yet)
      const yesterday = new Date(check);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d === yesterday.toISOString().split('T')[0] && streak === 0) {
        streak++;
        check = yesterday;
        check.setDate(check.getDate() - 1);
      } else {
        break;
      }
    }
  }
  return streak;
}

function updateSkillsFromHabit(db, category) {
  switch (category) {
    case 'mental':
      db.skills.focusClarity = Math.min(100, db.skills.focusClarity + 3);
      db.skills.intuition = Math.min(100, db.skills.intuition + 1);
      break;
    case 'physical':
      db.skills.agility = Math.min(100, db.skills.agility + 3);
      db.skills.stability = Math.min(100, db.skills.stability + 2);
      break;
    case 'creative':
      db.skills.intuition = Math.min(100, db.skills.intuition + 3);
      db.skills.agility = Math.min(100, db.skills.agility + 1);
      break;
    case 'social':
      db.skills.stability = Math.min(100, db.skills.stability + 3);
      db.skills.focusClarity = Math.min(100, db.skills.focusClarity + 1);
      break;
  }
}

// ─── Streak updater (called at end of day logic) ───
function updateStreak(db) {
  const today = getToday();
  const completedAny = db.habits.some(h => h.completedDates.includes(today));
  if (completedAny) {
    if (db.user.lastActiveDate !== today) {
      db.user.streak++;
      db.user.lastActiveDate = today;
    }
  }
}

// ─── SPA Fallback ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  ✨ AURA Habit Tracker running at http://localhost:${PORT}\n`);
});
