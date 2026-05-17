// T-Video Media - Data Layer
// Provides window.DEMO with user state, API methods, and local caching.

// HTML-escape utility (global, available to all pages)
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

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

  // Helper for API calls (internal to data.js)
  // Re-reads token on every call to avoid stale-token issues
  function apiFetch(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers['Content-Type'] = 'application/json';
    var token = localStorage.getItem(TOKEN_KEY);
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

  DEMO.api.resetUser = function () {
    DEMO.user = Object.assign({}, defaultUser);
    DEMO.transactions = [];
    DEMO.withdrawals = [];
    DEMO.tasks = [];
    persist();

    var token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      apiFetch('/api/settings/reset', { method: 'DELETE' })
        .catch(function () { /* offline fallback */ });
    }
  };

  DEMO.resetUser = DEMO.api.resetUser;

  // ---- Load essential data from API on page load (if token exists) ----
  function loadFromAPI() {
    var token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    // Fetch user profile (used by multiple pages for DEMO.user cache)
    apiFetch('/api/auth/me').then(function (res) {
      if (res.user) {
        DEMO.user = res.user;
        DEMO.user.referrals = DEMO.user.referrals || 0;
        persist();
      }
    }).catch(function () { /* use cached data */ });

    // Fetch VIP tiers (used by multiple pages for DEMO.vipTiers cache)
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
  }

  loadFromAPI();

  window.DEMO = DEMO;
})();
