// T-Video Media Demo - Data Layer
// Provides window.DEMO with user state, API methods, and local caching.
// Educational demo for scam-awareness research.

(function () {
  'use strict';

  var TOKEN_KEY = 'tvmd_token';
  var CACHE_KEY = 'tvmd_cache';

  // Default VIP tiers (used as fallback)
  var defaultTiers = [
    { level: 0, name: 'VIP 0 (Free)', price: 0, daily: 3, dailyIncome: 1.50, monthlyIncome: 45, featured: false, free: true },
    { level: 1, name: 'VIP 1', price: 30, daily: 6, dailyIncome: 4.00, monthlyIncome: 120, featured: false, free: false },
    { level: 2, name: 'VIP 2', price: 100, daily: 10, dailyIncome: 12.00, monthlyIncome: 360, featured: false, free: false },
    { level: 3, name: 'VIP 3', price: 300, daily: 15, dailyIncome: 35.00, monthlyIncome: 1050, featured: true, free: false },
    { level: 4, name: 'VIP 4', price: 800, daily: 25, dailyIncome: 95.00, monthlyIncome: 2850, featured: false, free: false },
    { level: 5, name: 'VIP 5', price: 2000, daily: 40, dailyIncome: 280.00, monthlyIncome: 8400, featured: false, free: false },
  ];

  // Default user (offline fallback)
  var defaultUser = {
    id: 0,
    username: 'demo_user',
    email: 'demo@example.test',
    balance: 0,
    totalEarnings: 0,
    todayEarnings: 0,
    completedTasks: 0,
    vipLevel: 0,
    inviteCode: 'TVMD-DEMO01',
    referrals: 0,
    isAdmin: false,
    avatar: 'DU',
  };

  // Default admin data (for when API is unavailable or user is not admin)
  var defaultAdmin = {
    totalUsers: 1248,
    totalDeposits: 184320,
    totalWithdrawals: 12480,
    pendingWithdrawals: 23,
    vipDistribution: [
      { level: 'VIP 0', pct: 35 },
      { level: 'VIP 1', pct: 28 },
      { level: 'VIP 2', pct: 18 },
      { level: 'VIP 3', pct: 11 },
      { level: 'VIP 4', pct: 5 },
      { level: 'VIP 5', pct: 3 },
    ],
    weeklyTasks: [320, 480, 390, 510, 420, 280, 190],
    users: [
      { id: 1, username: 'admin_demo', vip: 5, balance: 4200.00, status: 'Active' },
      { id: 2, username: 'user_alpha', vip: 3, balance: 890.50, status: 'Active' },
      { id: 3, username: 'user_beta', vip: 2, balance: 150.25, status: 'Active' },
      { id: 4, username: 'user_gamma', vip: 1, balance: 45.00, status: 'Suspended' },
      { id: 5, username: 'user_delta', vip: 0, balance: 0.00, status: 'Active' },
    ],
    pendingReview: [
      { id: 'WD-0042', username: 'user_alpha', amount: 200.00, address: 'TRC20-demo-addr-001', date: '2025-05-16' },
      { id: 'WD-0041', username: 'user_beta', amount: 50.00, address: 'BEP20-demo-addr-002', date: '2025-05-15' },
    ],
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

  // Helper for API calls
  function apiFetch(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = 'Bearer ' + token;
    opts.headers = headers;
    return fetch(path, opts).then(function (res) {
      if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        // On auth pages, do not redirect
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
  DEMO.admin = cache.admin || defaultAdmin;
  DEMO.tasks = cache.tasks || [];

  function persist() {
    saveCache({
      user: DEMO.user,
      transactions: DEMO.transactions,
      withdrawals: DEMO.withdrawals,
      referrals: DEMO.referrals,
      messages: DEMO.messages,
      vipTiers: DEMO.vipTiers,
      admin: DEMO.admin,
      tasks: DEMO.tasks,
    });
  }

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

    // Optimistic update
    if (!DEMO.tasks) DEMO.tasks = [];
    DEMO.tasks.push({ id: taskId, date: today });
    DEMO.user.balance = (DEMO.user.balance || 0) + reward;
    DEMO.user.todayEarnings = (DEMO.user.todayEarnings || 0) + reward;
    DEMO.user.totalEarnings = (DEMO.user.totalEarnings || 0) + reward;
    DEMO.user.completedTasks = (DEMO.user.completedTasks || 0) + 1;
    DEMO.transactions.unshift({
      type: 'Task Reward',
      amount: reward,
      status: 'Completed',
      desc: 'Completed ' + taskId,
      date: today,
    });
    persist();

    // Fire API call in background
    if (token) {
      apiFetch('/api/tasks/' + encodeURIComponent(taskId) + '/complete', { method: 'POST' })
        .then(function (res) {
          if (res.balance !== undefined) DEMO.user.balance = res.balance;
          if (res.todayEarnings !== undefined) DEMO.user.todayEarnings = res.todayEarnings;
          persist();
        }).catch(function () { /* offline fallback */ });
    }

    return { ok: true };
  };

  DEMO.api.buyPackage = function (level) {
    var tier = DEMO.vipTiers.find(function (t) { return t.level === level; });
    if (!tier) return { ok: false, error: 'Invalid tier' };
    if (tier.price > 0 && DEMO.user.balance < tier.price) {
      return { ok: false, error: 'Insufficient balance. You need $' + tier.price.toFixed(2) };
    }

    // Optimistic update
    if (tier.price > 0) {
      DEMO.user.balance -= tier.price;
      DEMO.transactions.unshift({
        type: 'VIP Upgrade',
        amount: -tier.price,
        status: 'Completed',
        desc: 'Upgraded to ' + tier.name,
        date: new Date().toISOString().split('T')[0],
      });
    }
    DEMO.user.vipLevel = level;
    persist();

    // Fire API call
    if (token) {
      apiFetch('/api/vip/buy', { method: 'POST', body: JSON.stringify({ level: level }) })
        .then(function (res) {
          if (res.user) {
            Object.assign(DEMO.user, res.user);
            persist();
          }
        }).catch(function () { /* offline fallback */ });
    }

    return { ok: true };
  };

  DEMO.api.submitWithdraw = function (amount, address) {
    if (!amount || amount <= 0) return { ok: false, error: 'Invalid amount' };
    if (amount > DEMO.user.balance) return { ok: false, error: 'Insufficient balance' };
    if (!address) return { ok: false, error: 'Address is required' };

    var today = new Date().toISOString().split('T')[0];
    // Optimistic update
    DEMO.user.balance -= amount;
    DEMO.withdrawals.unshift({ amount: amount, address: address, status: 'Pending', date: today });
    DEMO.transactions.unshift({
      type: 'Withdraw',
      amount: -amount,
      status: 'Pending',
      desc: 'Withdrawal to ' + address,
      date: today,
    });
    persist();

    if (token) {
      apiFetch('/api/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount: amount, address: address }) })
        .then(function (res) {
          if (res.balance !== undefined) DEMO.user.balance = res.balance;
          persist();
        }).catch(function () { /* offline fallback */ });
    }

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

    // Fetch admin data if admin
    if (DEMO.user.isAdmin) {
      apiFetch('/api/admin/stats').then(function (res) {
        if (res.totalUsers !== undefined) {
          DEMO.admin = res;
          persist();
        }
      }).catch(function () { /* use cached data */ });
    }
  }

  loadFromAPI();

  window.DEMO = DEMO;
})();
