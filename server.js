const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
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

// ─── Session Management ───
// Simple in-memory sessions (in production, use Redis or similar)
const sessions = {};

function createSession(userId) {
  const sessionId = crypto.randomUUID();
  sessions[sessionId] = { userId, createdAt: Date.now() };
  return sessionId;
}

function getSessionUserId(sessionId) {
  const session = sessions[sessionId];
  if (session) return session.userId;
  return null;
}

function deleteSession(sessionId) {
  delete sessions[sessionId];
}

// Get user from request (via session cookie or header)
function getUserFromRequest(req, db) {
  // Check for session in cookie or header
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
  if (!sessionId) return null;
  
  const userId = getSessionUserId(sessionId);
  if (!userId) return null;
  
  const user = db.users.find(u => u.id === userId);
  return user || null;
}

// Middleware to parse cookies
app.use((req, res, next) => {
  const cookieHeader = req.headers.cookie;
  req.cookies = {};
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      req.cookies[name] = value;
    });
  }
  next();
});

// ─── Create Default User Data Structure ───
function createDefaultUserData(name, username, email, password) {
  const usertag = username.toLowerCase().replace(/\s+/g, '_') + '#' + Math.floor(1000 + Math.random() * 9000);
  
  return {
    id: genId(),
    name,
    username,
    usertag,
    email: email.toLowerCase(),
    password, // In production, hash this!
    level: 1,
    xp: 0,
    xpToNext: 1000,
    streak: 0,
    lastActiveDate: null,
    dailyXpGoal: 4000,
    dailyXpEarned: 0,
    totalFocusMinutes: 0,
    profileImage: null,
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
        description: "Complete 4 hours of deep focused work to master the art of concentration.",
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
    friends: [],           // Array of friend user IDs
    friendRequests: [],    // Incoming friend requests: { id, fromUserId, fromUsertag, fromName, sentAt }
    sentRequests: [],      // Outgoing friend requests: { id, toUserId, toUsertag, sentAt }
    createdAt: new Date().toISOString()
  };
}

function createDefaultDB() {
  return {
    users: [],  // Array of user objects
    version: 2  // DB schema version
  };
}

// ─── Initialize DB ───
function initDB() {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  
  let db = readDB();
  
  // Check if DB needs migration (from old single-user to new multi-user)
  if (!db || !db.users) {
    // Create fresh multi-user DB
    db = createDefaultDB();
    writeDB(db);
  }
}

// Reset daily counters for a user if it's a new day
function resetDailyIfNeeded(user) {
  const today = getToday();
  if (user.lastActiveDate !== today) {
    user.dailyXpEarned = 0;
    user.timer.totalFocusToday = 0;
    user.timer.remaining = user.timer.duration;
    user.timer.isRunning = false;
    // Update streak
    if (user.lastActiveDate) {
      const last = new Date(user.lastActiveDate);
      const now = new Date(today);
      const diffDays = Math.round((now - last) / (1000 * 60 * 60 * 24));
      if (diffDays > 1) {
        user.streak = 0; // streak broken
      }
    }
    return true; // Changed
  }
  return false;
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
  
  const emailLower = email.toLowerCase();
  
  // Check if email already exists
  if (db.users.some(u => u.email === emailLower)) {
    return res.status(400).json({ error: 'An account with this email already exists.' });
  }
  
  // Check if username is taken (check usertag prefix)
  const usernameLower = username.toLowerCase().replace(/\s+/g, '_');
  
  // Create new user
  const newUser = createDefaultUserData(name, username, email, password);
  db.users.push(newUser);
  writeDB(db);
  
  // Create session
  const sessionId = createSession(newUser.id);
  
  res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Strict`);
  res.json({ 
    message: 'Registration successful', 
    sessionId,
    usertag: newUser.usertag,
    user: { name: newUser.name, username: newUser.username }
  });
});

app.post('/api/auth/login', (req, res) => {
  const db = readDB();
  const { email, password, identifier } = req.body;
  
  // Support both 'email' and 'identifier' fields
  const loginId = (email || identifier || '').toLowerCase();
  
  // Find user by email or username
  const user = db.users.find(u => 
    u.email === loginId || 
    u.username.toLowerCase() === loginId ||
    (u.usertag && u.usertag.toLowerCase() === loginId)
  );
  
  if (!user) {
    return res.status(401).json({ error: 'No account found with these credentials. Please sign up first.' });
  }
  
  if (user.password !== password) {
    return res.status(401).json({ error: 'Invalid password.' });
  }
  
  // Reset daily counters if needed
  if (resetDailyIfNeeded(user)) {
    writeDB(db);
  }
  
  // Create session
  const sessionId = createSession(user.id);
  
  res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Strict`);
  res.json({ 
    message: 'Login successful', 
    sessionId,
    user: { name: user.name, username: user.username }
  });
});

// Auth check
app.get('/api/auth/check', (req, res) => {
  const db = readDB();
  const user = getUserFromRequest(req, db);
  
  if (user) {
    res.json({ authenticated: true, user: { name: user.name, username: user.username } });
  } else {
    res.json({ authenticated: false });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const sessionId = req.headers['x-session-id'] || req.cookies?.sessionId;
  if (sessionId) {
    deleteSession(sessionId);
  }
  res.setHeader('Set-Cookie', 'sessionId=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ message: 'Logged out successfully' });
});

// ─── Auth Middleware for Protected Routes ───
function requireAuth(req, res, next) {
  const db = readDB();
  const user = getUserFromRequest(req, db);
  
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  req.user = user;
  req.db = db;
  next();
}

// ─── User ───
app.get('/api/user', requireAuth, (req, res) => {
  // Exclude password from response
  const { password, ...safeUser } = req.user;
  res.json(safeUser);
});

app.put('/api/user', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  if (userIdx === -1) return res.status(404).json({ error: 'User not found' });
  
  // Prevent password from being updated via this endpoint
  const { password, id, email, usertag, ...updates } = req.body;
  Object.assign(db.users[userIdx], updates);
  writeDB(db);
  
  const { password: pwd, ...safeUser } = db.users[userIdx];
  res.json(safeUser);
});

// ─── User's Usertag ───
app.get('/api/user/usertag', requireAuth, (req, res) => {
  res.json({ usertag: req.user.usertag });
});

// ─── Habits ───
app.get('/api/habits', requireAuth, (req, res) => {
  const today = getToday();
  const habits = req.user.habits.map(h => ({
    ...h,
    completedToday: h.completedDates.includes(today),
    currentStreak: calculateStreak(h.completedDates)
  }));
  res.json(habits);
});

app.post('/api/habits', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  
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
  
  db.users[userIdx].habits.push(habit);
  writeDB(db);
  res.json(habit);
});

app.put('/api/habits/:id', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  const habitIdx = db.users[userIdx].habits.findIndex(h => h.id === req.params.id);
  
  if (habitIdx === -1) return res.status(404).json({ error: 'Habit not found' });
  
  Object.assign(db.users[userIdx].habits[habitIdx], req.body);
  writeDB(db);
  res.json(db.users[userIdx].habits[habitIdx]);
});

app.delete('/api/habits/:id', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  db.users[userIdx].habits = db.users[userIdx].habits.filter(h => h.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/habits/:id/toggle', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  const user = db.users[userIdx];
  const habit = user.habits.find(h => h.id === req.params.id);
  
  if (!habit) return res.status(404).json({ error: 'Habit not found' });

  const today = getToday();
  const idx = habit.completedDates.indexOf(today);

  if (idx === -1) {
    // Complete
    habit.completedDates.push(today);
    user.xp += habit.xpReward;
    user.dailyXpEarned += habit.xpReward;
    // Track weekly growth
    const dow = getDayOfWeek();
    user.weeklyGrowth[dow] += habit.xpReward;
    // Update streak
    user.lastActiveDate = today;
    if (user.streak === 0) user.streak = 1;
    // Tier up every 7 completions
    if (habit.completedDates.length % 7 === 0) {
      habit.tier = Math.min(habit.tier + 1, 5);
    }
    // Level up check
    while (user.xp >= user.xpToNext) {
      user.xp -= user.xpToNext;
      user.level++;
      user.xpToNext = Math.floor(user.xpToNext * 1.25);
      // Unlock inventory item on level up
      const locked = user.inventory.find(i => !i.unlocked);
      if (locked) locked.unlocked = true;
    }
    // Update skills based on category
    updateSkillsFromHabit(user, habit.category);
  } else {
    // Un-complete
    habit.completedDates.splice(idx, 1);
    user.xp = Math.max(0, user.xp - habit.xpReward);
    user.dailyXpEarned = Math.max(0, user.dailyXpEarned - habit.xpReward);
    const dow = getDayOfWeek();
    user.weeklyGrowth[dow] = Math.max(0, user.weeklyGrowth[dow] - habit.xpReward);
  }

  // Calculate efficiency
  const totalPossibleXp = user.habits.reduce((sum, h) => sum + h.xpReward, 0);
  const earnedToday = user.habits.reduce((sum, h) => {
    return sum + (h.completedDates.includes(today) ? h.xpReward : 0);
  }, 0);
  user.efficiency = totalPossibleXp > 0 ? Math.round((earnedToday / totalPossibleXp) * 100) : 0;

  writeDB(db);
  
  const { password, ...safeUser } = user;
  res.json({
    habit: { ...habit, completedToday: habit.completedDates.includes(today), currentStreak: calculateStreak(habit.completedDates) },
    user: safeUser
  });
});

// ─── Quests ───
app.get('/api/quests', requireAuth, (req, res) => {
  res.json(req.user.quests);
});

app.post('/api/quests', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  
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
  
  db.users[userIdx].quests.push(quest);
  writeDB(db);
  res.json(quest);
});

app.get('/api/quests/:id', requireAuth, (req, res) => {
  const quest = req.user.quests.find(q => q.id === req.params.id);
  if (!quest) return res.status(404).json({ error: 'Quest not found' });
  res.json(quest);
});

app.delete('/api/quests/:id', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  db.users[userIdx].quests = db.users[userIdx].quests.filter(q => q.id !== req.params.id);
  writeDB(db);
  res.json({ success: true });
});

app.post('/api/quests/:id/objectives/:objId/toggle', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  const quest = db.users[userIdx].quests.find(q => q.id === req.params.id);
  
  if (!quest) return res.status(404).json({ error: 'Quest not found' });

  const obj = quest.objectives.find(o => o.id === req.params.objId);
  if (!obj) return res.status(404).json({ error: 'Objective not found' });

  obj.completed = !obj.completed;
  writeDB(db);
  res.json(quest);
});

app.post('/api/quests/:id/complete', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  const user = db.users[userIdx];
  const quest = user.quests.find(q => q.id === req.params.id);
  
  if (!quest) return res.status(404).json({ error: 'Quest not found' });

  quest.completed = true;
  quest.active = false;
  user.xp += quest.xpReward;
  user.dailyXpEarned += quest.xpReward;

  const dow = getDayOfWeek();
  user.weeklyGrowth[dow] += quest.xpReward;
  user.lastActiveDate = getToday();

  // Level up check
  while (user.xp >= user.xpToNext) {
    user.xp -= user.xpToNext;
    user.level++;
    user.xpToNext = Math.floor(user.xpToNext * 1.25);
    const locked = user.inventory.find(i => !i.unlocked);
    if (locked) locked.unlocked = true;
  }

  writeDB(db);
  
  const { password, ...safeUser } = user;
  res.json({ quest, user: safeUser });
});

// ─── Skills ───
app.get('/api/skills', requireAuth, (req, res) => {
  res.json(req.user.skills);
});

app.post('/api/skills/evolve', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  const user = db.users[userIdx];
  
  const cost = 500;
  if (user.xp < cost) return res.status(400).json({ error: 'Not enough XP' });

  user.xp -= cost;
  const { skill } = req.body;
  if (user.skills[skill] !== undefined) {
    user.skills[skill] = Math.min(100, user.skills[skill] + 10);
  }
  writeDB(db);
  
  const { password, ...safeUser } = user;
  res.json({ skills: user.skills, user: safeUser });
});

// ─── Timer ───
app.get('/api/timer', requireAuth, (req, res) => {
  res.json(req.user.timer);
});

app.put('/api/timer', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  Object.assign(db.users[userIdx].timer, req.body);
  writeDB(db);
  res.json(db.users[userIdx].timer);
});

app.post('/api/timer/complete', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  const user = db.users[userIdx];
  
  const minutesCompleted = Math.round(user.timer.duration / 60);
  user.timer.totalFocusToday += minutesCompleted;
  user.totalFocusMinutes += minutesCompleted;
  user.timer.remaining = user.timer.duration;
  user.timer.isRunning = false;

  // Award XP for focus session
  const xpEarned = minutesCompleted * 4;
  user.xp += xpEarned;
  user.dailyXpEarned += xpEarned;
  user.lastActiveDate = getToday();

  const dow = getDayOfWeek();
  user.weeklyGrowth[dow] += xpEarned;

  // Loot progress
  user.lootProgress = Math.min(user.lootTarget, user.timer.totalFocusToday / 60);
  if (user.lootProgress >= user.lootTarget) {
    const locked = user.inventory.find(i => !i.unlocked);
    if (locked) locked.unlocked = true;
    user.lootProgress = 0;
  }

  // Level up
  while (user.xp >= user.xpToNext) {
    user.xp -= user.xpToNext;
    user.level++;
    user.xpToNext = Math.floor(user.xpToNext * 1.25);
  }

  // Update skills
  user.skills.focusClarity = Math.min(100, user.skills.focusClarity + 2);
  user.skills.stability = Math.min(100, user.skills.stability + 1);

  writeDB(db);
  
  const { password, ...safeUser } = user;
  res.json({ timer: user.timer, user: safeUser, xpEarned });
});

// ─── Profile Image Upload ───
app.post('/api/user/avatar', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  const { image } = req.body;
  
  if (!image) return res.status(400).json({ error: 'No image provided' });
  
  db.users[userIdx].profileImage = image;
  writeDB(db);
  res.json({ profileImage: db.users[userIdx].profileImage });
});

app.delete('/api/user/avatar', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  db.users[userIdx].profileImage = null;
  writeDB(db);
  res.json({ success: true });
});

// ─── Friends ───

// Get friends list with their current data
app.get('/api/friends', requireAuth, (req, res) => {
  const db = req.db;
  const friendIds = req.user.friends || [];
  
  // Get actual friend data from users collection
  const friendsData = friendIds.map(friendId => {
    const friend = db.users.find(u => u.id === friendId);
    if (!friend) return null;
    
    // Return safe public data
    return {
      id: friend.id,
      username: friend.username,
      usertag: friend.usertag,
      name: friend.name,
      profileImage: friend.profileImage,
      level: friend.level,
      xp: friend.xp,
      xpToNext: friend.xpToNext,
      streak: friend.streak,
      totalFocusMinutes: friend.totalFocusMinutes,
      habitsCompleted: friend.habits.filter(h => h.completedDates.length > 0).length,
      questsCompleted: friend.quests.filter(q => q.completed).length
    };
  }).filter(Boolean);
  
  res.json(friendsData);
});

// Send friend request by usertag
app.post('/api/friends/request', requireAuth, (req, res) => {
  const db = req.db;
  const { usertag } = req.body;
  
  if (!usertag || !usertag.trim()) {
    return res.status(400).json({ error: 'Usertag is required' });
  }
  
  const cleanUsertag = usertag.trim().toLowerCase();
  
  // Check if it's own usertag
  if (req.user.usertag.toLowerCase() === cleanUsertag) {
    return res.status(400).json({ error: "You can't send a friend request to yourself" });
  }
  
  // Find target user by usertag
  const targetUser = db.users.find(u => u.usertag.toLowerCase() === cleanUsertag);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found. Make sure the usertag is correct (e.g., username#1234)' });
  }
  
  // Check if already friends
  if ((req.user.friends || []).includes(targetUser.id)) {
    return res.status(400).json({ error: 'This user is already your friend' });
  }
  
  // Check if request already sent
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  if (!db.users[userIdx].sentRequests) db.users[userIdx].sentRequests = [];
  
  if (db.users[userIdx].sentRequests.some(r => r.toUserId === targetUser.id)) {
    return res.status(400).json({ error: 'Friend request already sent to this user' });
  }
  
  // Check if there's a pending request FROM this user to us (auto-accept)
  const targetIdx = db.users.findIndex(u => u.id === targetUser.id);
  if (!db.users[targetIdx].sentRequests) db.users[targetIdx].sentRequests = [];
  
  const incomingRequest = db.users[targetIdx].sentRequests.find(r => r.toUserId === req.user.id);
  if (incomingRequest) {
    // Auto-accept: they sent us a request, we're sending one back
    // Add each other as friends
    if (!db.users[userIdx].friends) db.users[userIdx].friends = [];
    if (!db.users[targetIdx].friends) db.users[targetIdx].friends = [];
    
    db.users[userIdx].friends.push(targetUser.id);
    db.users[targetIdx].friends.push(req.user.id);
    
    // Remove the pending requests
    db.users[targetIdx].sentRequests = db.users[targetIdx].sentRequests.filter(r => r.toUserId !== req.user.id);
    if (!db.users[userIdx].friendRequests) db.users[userIdx].friendRequests = [];
    db.users[userIdx].friendRequests = db.users[userIdx].friendRequests.filter(r => r.fromUserId !== targetUser.id);
    
    writeDB(db);
    return res.json({ message: 'You are now friends!', autoAccepted: true });
  }
  
  // Create request
  const requestId = genId();
  
  // Add to sender's sent requests
  db.users[userIdx].sentRequests.push({
    id: requestId,
    toUserId: targetUser.id,
    toUsertag: targetUser.usertag,
    sentAt: new Date().toISOString()
  });
  
  // Add to recipient's incoming requests
  if (!db.users[targetIdx].friendRequests) db.users[targetIdx].friendRequests = [];
  db.users[targetIdx].friendRequests.push({
    id: requestId,
    fromUserId: req.user.id,
    fromUsertag: req.user.usertag,
    fromName: req.user.name,
    sentAt: new Date().toISOString()
  });
  
  writeDB(db);
  res.json({ message: 'Friend request sent!' });
});

// Get sent friend requests
app.get('/api/friends/requests/sent', requireAuth, (req, res) => {
  res.json(req.user.sentRequests || []);
});

// Get received friend requests
app.get('/api/friends/requests/received', requireAuth, (req, res) => {
  res.json(req.user.friendRequests || []);
});

// Accept friend request
app.post('/api/friends/request/:id/accept', requireAuth, (req, res) => {
  const db = req.db;
  const requestId = req.params.id;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  
  if (!db.users[userIdx].friendRequests) db.users[userIdx].friendRequests = [];
  const requestIdx = db.users[userIdx].friendRequests.findIndex(r => r.id === requestId);
  
  if (requestIdx === -1) {
    return res.status(404).json({ error: 'Friend request not found' });
  }
  
  const request = db.users[userIdx].friendRequests[requestIdx];
  const senderIdx = db.users.findIndex(u => u.id === request.fromUserId);
  
  if (senderIdx === -1) {
    // Sender no longer exists, just remove the request
    db.users[userIdx].friendRequests.splice(requestIdx, 1);
    writeDB(db);
    return res.status(404).json({ error: 'The user who sent this request no longer exists' });
  }
  
  // Add each other as friends
  if (!db.users[userIdx].friends) db.users[userIdx].friends = [];
  if (!db.users[senderIdx].friends) db.users[senderIdx].friends = [];
  
  if (!db.users[userIdx].friends.includes(request.fromUserId)) {
    db.users[userIdx].friends.push(request.fromUserId);
  }
  if (!db.users[senderIdx].friends.includes(req.user.id)) {
    db.users[senderIdx].friends.push(req.user.id);
  }
  
  // Remove the request from recipient
  db.users[userIdx].friendRequests.splice(requestIdx, 1);
  
  // Remove from sender's sent requests
  if (db.users[senderIdx].sentRequests) {
    db.users[senderIdx].sentRequests = db.users[senderIdx].sentRequests.filter(r => r.id !== requestId);
  }
  
  writeDB(db);
  
  // Return friend data
  const sender = db.users[senderIdx];
  const friend = {
    id: sender.id,
    username: sender.username,
    usertag: sender.usertag,
    name: sender.name,
    profileImage: sender.profileImage,
    level: sender.level,
    xp: sender.xp,
    xpToNext: sender.xpToNext,
    streak: sender.streak,
    totalFocusMinutes: sender.totalFocusMinutes,
    habitsCompleted: sender.habits.filter(h => h.completedDates.length > 0).length,
    questsCompleted: sender.quests.filter(q => q.completed).length
  };
  
  res.json({ message: 'Friend request accepted!', friend });
});

// Decline friend request
app.post('/api/friends/request/:id/decline', requireAuth, (req, res) => {
  const db = req.db;
  const requestId = req.params.id;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  
  if (!db.users[userIdx].friendRequests) db.users[userIdx].friendRequests = [];
  
  const request = db.users[userIdx].friendRequests.find(r => r.id === requestId);
  if (request) {
    // Remove from sender's sent requests too
    const senderIdx = db.users.findIndex(u => u.id === request.fromUserId);
    if (senderIdx !== -1 && db.users[senderIdx].sentRequests) {
      db.users[senderIdx].sentRequests = db.users[senderIdx].sentRequests.filter(r => r.id !== requestId);
    }
  }
  
  db.users[userIdx].friendRequests = db.users[userIdx].friendRequests.filter(r => r.id !== requestId);
  writeDB(db);
  
  res.json({ message: 'Friend request declined' });
});

// Cancel sent friend request
app.delete('/api/friends/request/:id', requireAuth, (req, res) => {
  const db = req.db;
  const requestId = req.params.id;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  
  if (!db.users[userIdx].sentRequests) db.users[userIdx].sentRequests = [];
  
  const request = db.users[userIdx].sentRequests.find(r => r.id === requestId);
  if (request) {
    // Remove from recipient's friend requests too
    const recipientIdx = db.users.findIndex(u => u.id === request.toUserId);
    if (recipientIdx !== -1 && db.users[recipientIdx].friendRequests) {
      db.users[recipientIdx].friendRequests = db.users[recipientIdx].friendRequests.filter(r => r.id !== requestId);
    }
  }
  
  db.users[userIdx].sentRequests = db.users[userIdx].sentRequests.filter(r => r.id !== requestId);
  writeDB(db);
  
  res.json({ message: 'Friend request cancelled' });
});

// Get friend by ID
app.get('/api/friends/:id', requireAuth, (req, res) => {
  const db = req.db;
  const friendId = req.params.id;
  
  // Check if actually friends
  if (!(req.user.friends || []).includes(friendId)) {
    return res.status(404).json({ error: 'Friend not found' });
  }
  
  const friend = db.users.find(u => u.id === friendId);
  if (!friend) return res.status(404).json({ error: 'Friend not found' });
  
  res.json({
    id: friend.id,
    username: friend.username,
    usertag: friend.usertag,
    name: friend.name,
    profileImage: friend.profileImage,
    level: friend.level,
    xp: friend.xp,
    xpToNext: friend.xpToNext,
    streak: friend.streak,
    totalFocusMinutes: friend.totalFocusMinutes,
    habitsCompleted: friend.habits.filter(h => h.completedDates.length > 0).length,
    questsCompleted: friend.quests.filter(q => q.completed).length
  });
});

// Remove friend
app.delete('/api/friends/:id', requireAuth, (req, res) => {
  const db = req.db;
  const friendId = req.params.id;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  const friendIdx = db.users.findIndex(u => u.id === friendId);
  
  // Remove from user's friends
  db.users[userIdx].friends = (db.users[userIdx].friends || []).filter(id => id !== friendId);
  
  // Remove from friend's friends too (mutual unfriend)
  if (friendIdx !== -1) {
    db.users[friendIdx].friends = (db.users[friendIdx].friends || []).filter(id => id !== req.user.id);
  }
  
  writeDB(db);
  res.json({ success: true });
});

// ─── Inventory ───
app.get('/api/inventory', requireAuth, (req, res) => {
  res.json({ 
    items: req.user.inventory, 
    lootProgress: req.user.lootProgress, 
    lootTarget: req.user.lootTarget 
  });
});

// ─── Stats (Weekly Growth) ───
app.get('/api/stats/weekly', requireAuth, (req, res) => {
  res.json(req.user.weeklyGrowth);
});

// ─── Full State (for initial load) ───
app.get('/api/state', requireAuth, (req, res) => {
  const db = req.db;
  const user = req.user;
  const today = getToday();
  
  const habits = user.habits.map(h => ({
    ...h,
    completedToday: h.completedDates.includes(today),
    currentStreak: calculateStreak(h.completedDates)
  }));
  
  // Get friends data
  const friendIds = user.friends || [];
  const friendsData = friendIds.map(friendId => {
    const friend = db.users.find(u => u.id === friendId);
    if (!friend) return null;
    return {
      id: friend.id,
      username: friend.username,
      usertag: friend.usertag,
      name: friend.name,
      profileImage: friend.profileImage,
      level: friend.level,
      xp: friend.xp,
      xpToNext: friend.xpToNext,
      streak: friend.streak,
      totalFocusMinutes: friend.totalFocusMinutes,
      habitsCompleted: friend.habits.filter(h => h.completedDates.length > 0).length,
      questsCompleted: friend.quests.filter(q => q.completed).length
    };
  }).filter(Boolean);
  
  const { password, ...safeUser } = user;
  
  res.json({
    user: safeUser,
    habits,
    quests: user.quests,
    skills: user.skills,
    timer: user.timer,
    inventory: user.inventory,
    weeklyGrowth: user.weeklyGrowth,
    lootProgress: user.lootProgress,
    lootTarget: user.lootTarget,
    friends: friendsData
  });
});

// ─── Reset (resets current user's data only) ───
app.post('/api/reset', requireAuth, (req, res) => {
  const db = req.db;
  const userIdx = db.users.findIndex(u => u.id === req.user.id);
  
  // Create fresh user data but keep auth info
  const newUserData = createDefaultUserData(
    req.user.name,
    req.user.username,
    req.user.email,
    req.user.password
  );
  
  // Keep the same ID and usertag
  newUserData.id = req.user.id;
  newUserData.usertag = req.user.usertag;
  
  db.users[userIdx] = newUserData;
  writeDB(db);
  
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

function updateSkillsFromHabit(user, category) {
  switch (category) {
    case 'mental':
      user.skills.focusClarity = Math.min(100, user.skills.focusClarity + 3);
      user.skills.intuition = Math.min(100, user.skills.intuition + 1);
      break;
    case 'physical':
      user.skills.agility = Math.min(100, user.skills.agility + 3);
      user.skills.stability = Math.min(100, user.skills.stability + 2);
      break;
    case 'creative':
      user.skills.intuition = Math.min(100, user.skills.intuition + 3);
      user.skills.agility = Math.min(100, user.skills.agility + 1);
      break;
    case 'social':
      user.skills.stability = Math.min(100, user.skills.stability + 3);
      user.skills.focusClarity = Math.min(100, user.skills.focusClarity + 1);
      break;
  }
}

// ─── SPA Fallback ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  AURA Habit Tracker running at http://localhost:${PORT}\n`);
});
