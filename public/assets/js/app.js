// T-Video Media Demo - UI Helpers (Shell, Modal, Toast, API client)
// Educational demo for scam-awareness research

(function () {
  'use strict';

  // ---- API Client ----
  var API = {};
  API.baseUrl = '';

  API.fetch = function (path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    var token = localStorage.getItem('tvmd_token');
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    opts.headers = headers;
    return fetch(API.baseUrl + path, opts).then(function (res) {
      if (res.status === 401) {
        localStorage.removeItem('tvmd_token');
        if (window.location.pathname.indexOf('login') === -1 && window.location.pathname.indexOf('register') === -1 && window.location.pathname.indexOf('index') === -1) {
          window.location.href = 'login.html';
        }
        return Promise.reject(new Error('Unauthorized'));
      }
      return res.json();
    });
  };

  window.API = API;

  // ---- UI ----
  var UI = {};

  var navItems = [
    { label: 'Home', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', href: 'dashboard.html' },
    { label: 'Video Tasks', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>', href: 'tasks.html' },
    { label: 'VIP Levels', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>', href: 'vip.html' },
    { label: 'Recharge', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>', href: 'recharge.html' },
    { label: 'Withdraw', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="15"/><polyline points="5 8 12 15 19 8"/><line x1="5" y1="21" x2="19" y2="21"/></svg>', href: 'withdraw.html' },
    { label: 'Invite', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>', href: 'invite.html' },
    { label: 'Team', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', href: 'team.html' },
    { label: 'Transactions', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>', href: 'transactions.html' },
    { label: 'Messages', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', href: 'messages.html' },
    { label: 'Support', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', href: 'support.html' },
    { label: 'Settings', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', href: 'settings.html' },
    { label: 'Admin', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', href: 'admin.html' },
    { label: 'Scam Analysis', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>', href: 'scam-analysis.html' },
  ];

  // ---- Logout helper ----
  UI.logout = function () {
    localStorage.removeItem('tvmd_token');
    localStorage.removeItem('tvmd_cache');
    window.location.href = 'login.html';
  };

  UI.renderShell = function (activeTitle) {
    var root = document.getElementById('appRoot');
    if (!root) return;

    var sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = '<a href="index.html" class="brand"><span class="brand-mark">T</span><span>T-Video</span></a><nav></nav>';
    var nav = sidebar.querySelector('nav');
    navItems.forEach(function (item) {
      var a = document.createElement('a');
      a.href = item.href;
      a.innerHTML = '<span class="nav-item-icon">' + item.icon + '</span><span>' + item.label + '</span>';
      if (item.label === activeTitle) a.className = 'active';
      nav.appendChild(a);
    });

    // Logout button at bottom of sidebar
    var logoutDiv = document.createElement('div');
    logoutDiv.style.cssText = 'padding:12px 16px;margin-top:auto;border-top:1px solid var(--line);';
    var logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-danger';
    logoutBtn.style.cssText = 'width:100%;';
    logoutBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Logout';
    logoutBtn.addEventListener('click', UI.logout);
    logoutDiv.appendChild(logoutBtn);
    sidebar.appendChild(logoutDiv);

    var main = document.createElement('div');
    main.className = 'main-area';
    var topbar = document.createElement('header');
    topbar.className = 'topbar';
    topbar.innerHTML = '<h2>' + (activeTitle || '') + '</h2><div class="topbar-actions"><a class="btn btn-sm" href="settings.html">Settings</a><button class="btn btn-sm btn-danger" id="topbarLogout">Logout</button></div>';
    main.appendChild(topbar);

    var content = document.createElement('main');
    content.className = 'content';
    main.appendChild(content);

    var shell = document.createElement('div');
    shell.className = 'app-shell';
    shell.appendChild(sidebar);
    shell.appendChild(main);
    root.appendChild(shell);

    // Bind topbar logout
    document.getElementById('topbarLogout').addEventListener('click', UI.logout);

    // Add hamburger button to topbar (mobile only)
    var hamburgerBtn = document.createElement('button');
    hamburgerBtn.className = 'hamburger-btn';
    hamburgerBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>';
    hamburgerBtn.setAttribute('aria-label', 'Open menu');
    topbar.insertBefore(hamburgerBtn, topbar.firstChild);

    // Mobile bottom navigation
    var bottomNavTabs = [
      { label: 'Home', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', href: 'dashboard.html', match: 'Home' },
      { label: 'Tasks', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>', href: 'tasks.html', match: 'Video Tasks' },
      { label: 'Wallet', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="15"/><polyline points="5 8 12 15 19 8"/><line x1="5" y1="21" x2="19" y2="21"/></svg>', href: 'withdraw.html', match: 'Withdraw' },
      { label: 'Team', icon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', href: 'team.html', match: 'Team' }
    ];

    var mobileNav = document.createElement('nav');
    mobileNav.className = 'mobile-bottom-nav';

    bottomNavTabs.forEach(function (tab) {
      var a = document.createElement('a');
      a.href = tab.href;
      a.className = 'nav-tab';
      if (activeTitle === tab.match || activeTitle === tab.label) a.className += ' active';
      a.innerHTML = '<span class="nav-icon">' + tab.icon + '</span><span class="nav-label">' + tab.label + '</span>';
      mobileNav.appendChild(a);
    });

    var moreBtn = document.createElement('button');
    moreBtn.className = 'nav-tab';
    moreBtn.id = 'moreTab';
    moreBtn.innerHTML = '<span class="nav-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></span><span class="nav-label">More</span>';
    mobileNav.appendChild(moreBtn);

    document.body.appendChild(mobileNav);

    // Mobile drawer
    var drawerItems = [
      { label: 'VIP Levels', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>', href: 'vip.html' },
      { label: 'Recharge', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>', href: 'recharge.html' },
      { label: 'Invite', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>', href: 'invite.html' },
      { label: 'Transactions', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>', href: 'transactions.html' },
      { label: 'Messages', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', href: 'messages.html' },
      { label: 'Support', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', href: 'support.html' },
      { label: 'Settings', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68 1.65 1.65 0 0 0 10 3.17V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', href: 'settings.html' },
      { label: 'Admin', icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', href: 'admin.html' }
    ];

    var drawerBackdrop = document.createElement('div');
    drawerBackdrop.className = 'mobile-drawer-backdrop';
    drawerBackdrop.id = 'mobileDrawer';

    var drawer = document.createElement('div');
    drawer.className = 'mobile-drawer';

    var handle = document.createElement('div');
    handle.className = 'drawer-handle';
    drawer.appendChild(handle);

    var drawerNav = document.createElement('nav');
    drawerNav.className = 'drawer-nav';
    drawerItems.forEach(function (item) {
      var a = document.createElement('a');
      a.href = item.href;
      if (activeTitle === item.label) a.className = 'active';
      a.innerHTML = '<span class="drawer-icon">' + item.icon + '</span>' + item.label;
      drawerNav.appendChild(a);
    });
    drawer.appendChild(drawerNav);

    var drawerLogout = document.createElement('button');
    drawerLogout.className = 'btn btn-danger';
    drawerLogout.style.cssText = 'width:100%;margin-top:12px;';
    drawerLogout.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Logout';
    drawerLogout.addEventListener('click', UI.logout);
    drawer.appendChild(drawerLogout);

    drawerBackdrop.appendChild(drawer);
    document.body.appendChild(drawerBackdrop);

    function openDrawer() { drawerBackdrop.classList.add('open'); }
    function closeDrawer() { drawerBackdrop.classList.remove('open'); }

    moreBtn.addEventListener('click', openDrawer);
    hamburgerBtn.addEventListener('click', openDrawer);
    drawerBackdrop.addEventListener('click', function (e) {
      if (e.target === drawerBackdrop) closeDrawer();
    });

    // Move template content into main content area
    var tpl = document.getElementById('pageContent');
    if (tpl) {
      content.appendChild(tpl.content.cloneNode(true));
    }
  };

  // ---- Modal ----
  UI.openModal = function (title, bodyHtml, opts) {
    opts = opts || {};
    // Remove existing modal
    var existing = document.getElementById('uiModal');
    if (existing) existing.remove();

    var backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';
    backdrop.id = 'uiModal';

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<h3>' + title + '</h3>' +
      '<div class="body">' + bodyHtml + '</div>' +
      '<div class="actions">' +
        '<button class="btn" id="modalCancel">Close</button>' +
        (opts.confirmText ? '<button class="btn btn-primary" id="modalConfirm">' + opts.confirmText + '</button>' : '') +
      '</div>';

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    document.getElementById('modalCancel').addEventListener('click', function () {
      backdrop.remove();
    });
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) backdrop.remove();
    });

    if (opts.confirmText && opts.onConfirm) {
      document.getElementById('modalConfirm').addEventListener('click', function () {
        opts.onConfirm();
        backdrop.remove();
      });
    } else if (opts.confirmText && !opts.manualClose) {
      document.getElementById('modalConfirm').addEventListener('click', function () {
        backdrop.remove();
      });
    }
  };

  // ---- Toast ----
  var toastContainer = null;
  UI.toast = function (msg) {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(function () { el.remove(); }, 3500);
  };

  window.UI = UI;
})();
