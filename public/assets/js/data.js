// T-Video Media - Data Layer
// Provides window.DEMO with user state, API methods, and local caching.

(function () {
  'use strict';

  var TOKEN_KEY = 'tvmd_token';
  var CACHE_KEY = 'tvmd_cache';

  // Default VIP tiers (used as fallback when API is unreachable)
  var defaultTiers = [
    { level: 0, name: 'VIP 0 (Free)', price: 0, daily: 3, dailyIncome: 1.50, monthlyIncome: 45, featured: false, free: true },
    { level: 1, name: 'VIP 1', price: 30, daily: 6, dailyIncome: 4.00, monthlyIncome: 120, featured: false, free: false },
    { level: 2, name: 'VIP 2', price: 100, daily: 10, dailyIncome: 12.00, monthlyIncome: 360, featured: false, free: false },
    { level: 3, name: 'VIP 3', price: 300, daily: 15, dailyIncome: 35.00, monthlyIncome: 1050, featured: true, free: false },
    { level: 4, name: 'VIP 4', price: 800, daily: 25, dailyIncome: 95.00, monthlyIncome: 2850, featured: false, free: false },
    { level: 5, name: 'VIP 5', price: 2000, daily: 40, dailyIncome: 280.00, monthlyIncome: 8400, featured: false, free: false },
  ];

  // Default user (offline fallback - all numeric values at 0)
  var defaultUser = {
    id: 0,
    username: '',
    email: '',
    balance: 0,
    totalEarnings: 0,
    todayEarnings: 0,
    completedTasks: 0,
    vipLevel: 0,
    inviteCode: '',
    referrals: 0,
    isAdmin: false,
    avatar: '',
  };

  // Load cache from localStorage
  function loadCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  var cache = loadCache() || {};
  var token = localStorage.getItem(TOKEN_KEY);

  // Helper for API calls (internal to data.js)
  function apiFetch(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = 'Bearer ' + token;
    opts.headers = headers;
    return fetch(path, opts).then(function (res) {
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        var loc = window.location.pathname;
        if (loc.indexOf('login') === -1 && loc.indexOf('register') === -1 && loc.indexOf('index') === -1) {
          window.location.href = 'login.html';
        }
        return Promise.reject(new Error('Unauthorized'));
      }
      return res.json();
    });
  }

  // ---- DEMO object ----
  var DEMO = {};

  // State properties (populated from cache or defaults)
  DEMO.user = cache.user || Object.assign({}, defaultUser);
  DEMO.transactions = cache.transactions || [];
  DEMO.withdrawals = cache.withdrawals || [];
  DEMO.referrals = cache.referrals || [];
  DEMO.messages = cache.messages || [];
  DEMO.vipTiers = cache.vipTiers || defaultTiers.slice();
  DEMO.tasks = cache.tasks || [];

  function persist() {
    saveCache({
      user: DEMO.user,
      transactions: DEMO.transactions,
      withdrawals: DEMO.withdrawals,
      referrals: DEMO.referrals,
      messages: DEMO.messages,
      vipTiers: DEMO.vipTiers,
      tasks: DEMO.tasks,
    });
  }

  DEMO.persist = persist;

  // ---- API methods ----
  DEMO.api = {};

  DEMO.api.getActiveVip = function () {
    var level = DEMO.user.vipLevel;
    if (level === undefined || level === null) return null;
    var tier = DEMO.vipTiers.find(function (t) { return t.level === level; });
    return tier || null;
  };

  DEMO.api.rewardPerTask = function () {
    var v = DEMO.api.getActiveVip();
    if (!v || !v.daily) return 0;
    return Math.round((v.dailyIncome / v.daily) * 100) / 100;
  };

  DEMO.api.generateDailyTasks = function () {
    var v = DEMO.api.getActiveVip();
    if (!v) return [];
    var reward = DEMO.api.rewardPerTask();
    var today = new Date().toISOString().split('T')[0];
    var titles = [
      'Product Review: Smart Home Devices',
      'Tech Unboxing: Latest Gadgets 2025',
      'Travel Vlog: Hidden Paradise',
      'Cooking Tutorial: Quick Recipes',
      'Fitness Challenge: 10 Min Workout',
      'DIY Crafts: Home Decor Ideas',
      'Gaming Highlights: Top Plays',
      'Music Mix: Chill Beats',
      'Fashion Lookbook: Summer Trends',
      'Science Explained: Space Facts',
      'Car Review: Electric Vehicles',
      'Pet Care: Training Tips',
      'Photography Tutorial: Night Shots',
      'Language Learning: Quick Phrases',
      'Art Tutorial: Watercolor Basics',
      'Dance Tutorial: Easy Steps',
      'Book Review: Must-Read Novels',
      'Gardening Tips: Indoor Plants',
      'Meditation Guide: 5 Minute Calm',
      'History Documentary: Ancient Wonders',
      'Sports Highlights: Best Goals',
      'Home Workout: No Equipment',
      'Movie Review: New Releases',
      'Podcast Episode: Life Lessons',
      'Street Food Tour: Asian Flavors',
      'Nature Documentary: Ocean Life',
      'Comedy Sketch: Daily Laughs',
      'Investment Basics: Beginners Guide',
      'Yoga Flow: Morning Routine',
      'Architecture Tour: Modern Design',
      'Wildlife Safari: African Plains',
      'Skateboard Tricks: Beginner to Pro',
      'Piano Tutorial: Simple Songs',
      'Astronomy Guide: Star Gazing',
      'Surfing Lessons: Wave Riding',
      'Drone Footage: City Skylines',
      'Martial Arts: Basic Moves',
      'Woodworking: Simple Projects',
      'Painting Tutorial: Landscapes',
      'Camping Guide: Survival Tips',
    ];
    var tasks = [];
    var completedIds = (DEMO.tasks || []).filter(function (t) { return t.date === today; }).map(function (t) { return t.id; });
    for (var i = 0; i < v.daily; i++) {
      var id = 'task-' + today + '-' + i;
      tasks.push({
        id: id,
        title: titles[i % titles.length],
        reward: reward,
        videoSrc: 'assets/videos/task-' + i + '.mp4',
        completed: completedIds.indexOf(id) !== -1,
      });
    }
    return tasks;
  };

  DEMO.api.completeTask = function (taskId, reward) {
    var today = new Date().toISOString().split('T')[0];
    var alreadyDone = (DEMO.tasks || []).find(function (t) { return t.id === taskId && t.date === today; });
    if (alreadyDone) return { ok: false, error: 'Task already completed' };

    // Mark as done locally so UI updates immediately
    if (!DEMO.tasks) DEMO.tasks = [];
    DEMO.tasks.push({ id: taskId, date: today });
    persist();

    // Call the API directly (no optimistic balance updates)
    apiFetch('/api/tasks/' + encodeURIComponent(taskId) + '/complete', { method: 'POST' })
      .then(function (res) {
        if (res.balance !== undefined) DEMO.user.balance = res.balance;
        if (res.todayEarnings !== undefined) DEMO.user.todayEarnings = res.todayEarnings;
        if (res.totalEarnings !== undefined) DEMO.user.totalEarnings = res.totalEarnings;
        DEMO.user.completedTasks = (DEMO.user.completedTasks || 0) + 1;
        persist();
      }).catch(function () { /* API error - task still marked locally */ });

    return { ok: true };
  };

  DEMO.api.setProfile = function (data) {
    if (data.username) DEMO.user.username = data.username;
    if (data.email) DEMO.user.email = data.email;
    persist();

    if (token) {
      apiFetch('/api/settings/profile', { method: 'PUT', body: JSON.stringify(data) })
        .catch(function () { /* offline fallback */ });
    }
  };

  DEMO.api.resetUser = function () {
    DEMO.user = Object.assign({}, defaultUser);
    DEMO.transactions = [];
    DEMO.withdrawals = [];
    DEMO.tasks = [];
    persist();

    if (token) {
      apiFetch('/api/settings/reset', { method: 'DELETE' })
        .catch(function () { /* offline fallback */ });
    }
  };

  DEMO.resetUser = DEMO.api.resetUser;

  // ---- Load data from API on page load (if token exists) ----
  function loadFromAPI() {
    if (!token) return;

    // Fetch user
    apiFetch('/api/auth/me').then(function (res) {
      if (res.user) {
        DEMO.user = res.user;
        DEMO.user.referrals = DEMO.user.referrals || 0;
        persist();
      }
    }).catch(function () { /* use cached data */ });

    // Fetch VIP tiers
    apiFetch('/api/vip/tiers').then(function (res) {
      if (res.tiers && res.tiers.length) {
        DEMO.vipTiers = res.tiers.map(function (t) {
          return {
            level: t.level,
            name: t.name,
            price: t.price,
            daily: t.daily_tasks,
            dailyIncome: t.daily_income,
            monthlyIncome: t.monthly_income,
            featured: !!t.featured,
            free: t.price === 0,
          };
        });
        persist();
      }
    }).catch(function () { /* use cached data */ });

    // Fetch transactions
    apiFetch('/api/transactions').then(function (res) {
      if (res.transactions) {
        DEMO.transactions = res.transactions;
        persist();
      }
    }).catch(function () { /* use cached data */ });

    // Fetch withdrawals
    apiFetch('/api/wallet/withdrawals').then(function (res) {
      if (res.withdrawals) {
        DEMO.withdrawals = res.withdrawals;
        persist();
      }
    }).catch(function () { /* use cached data */ });

    // Fetch team/referrals
    apiFetch('/api/team').then(function (res) {
      if (res.referrals) {
        DEMO.referrals = res.referrals;
        DEMO.user.referrals = res.referrals.length;
        persist();
      }
    }).catch(function () { /* use cached data */ });

    // Fetch messages
    apiFetch('/api/messages').then(function (res) {
      if (res.messages) {
        DEMO.messages = res.messages;
        persist();
      }
    }).catch(function () { /* use cached data */ });
  }

  loadFromAPI();

  window.DEMO = DEMO;
})();
