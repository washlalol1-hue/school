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
    { label: 'Home', icon: '🏠', href: 'dashboard.html' },
    { label: 'Video Tasks', icon: '🎬', href: 'tasks.html' },
    { label: 'VIP Levels', icon: '👑', href: 'vip.html' },
    { label: 'Recharge', icon: '💳', href: 'recharge.html' },
    { label: 'Withdraw', icon: '💸', href: 'withdraw.html' },
    { label: 'Invite', icon: '🤝', href: 'invite.html' },
    { label: 'Team', icon: '👥', href: 'team.html' },
    { label: 'Transactions', icon: '📋', href: 'transactions.html' },
    { label: 'Messages', icon: '💬', href: 'messages.html' },
    { label: 'Support', icon: '🛟', href: 'support.html' },
    { label: 'Settings', icon: '⚙️', href: 'settings.html' },
    { label: 'Admin', icon: '🛡️', href: 'admin.html' },
    { label: 'Scam Analysis', icon: '📖', href: 'scam-analysis.html' },
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
      a.textContent = item.icon + '  ' + item.label;
      if (item.label === activeTitle) a.className = 'active';
      nav.appendChild(a);
    });

    // Logout button at bottom of sidebar
    var logoutDiv = document.createElement('div');
    logoutDiv.style.cssText = 'padding:12px 16px;margin-top:auto;border-top:1px solid var(--line);';
    var logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-danger';
    logoutBtn.style.cssText = 'width:100%;';
    logoutBtn.textContent = '🚪  Logout';
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
    hamburgerBtn.innerHTML = '☰';
    hamburgerBtn.setAttribute('aria-label', 'Open menu');
    topbar.insertBefore(hamburgerBtn, topbar.firstChild);

    // Mobile bottom navigation
    var bottomNavTabs = [
      { label: 'Home', icon: '🏠', href: 'dashboard.html', match: 'Home' },
      { label: 'Tasks', icon: '🎬', href: 'tasks.html', match: 'Video Tasks' },
      { label: 'Wallet', icon: '💸', href: 'withdraw.html', match: 'Withdraw' },
      { label: 'Team', icon: '👥', href: 'team.html', match: 'Team' }
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
    moreBtn.innerHTML = '<span class="nav-icon">☰</span><span class="nav-label">More</span>';
    mobileNav.appendChild(moreBtn);

    document.body.appendChild(mobileNav);

    // Mobile drawer
    var drawerItems = [
      { label: 'VIP Levels', icon: '👑', href: 'vip.html' },
      { label: 'Recharge', icon: '💳', href: 'recharge.html' },
      { label: 'Invite', icon: '🤝', href: 'invite.html' },
      { label: 'Transactions', icon: '📋', href: 'transactions.html' },
      { label: 'Messages', icon: '💬', href: 'messages.html' },
      { label: 'Support', icon: '🛟', href: 'support.html' },
      { label: 'Settings', icon: '⚙️', href: 'settings.html' },
      { label: 'Admin', icon: '🛡️', href: 'admin.html' }
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
    drawerLogout.textContent = '🚪 Logout';
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
