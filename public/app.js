// KYROS Portfolio & Revenue Command Center Frontend
(function () {
  'use strict';

  // State
  const state = {
    theme: localStorage.getItem('kyros_theme') || 'system',
    activeMonth: getCurrentMonthKey(),
    summary: null,
    sites: [],
    expenses: [],
    activeStatusFilter: 'running',
    searchQuery: '',
    ledgerRange: 'thisMonth',
    page: 1,
    pageSize: 25,
    isSaving: false
  };

  // Helpers
  function getCurrentMonthKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function formatMonthLabel(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[m - 1]} ${y}`;
  }

  function formatMoney(amount, showSign = false) {
    const num = Number(amount) || 0;
    const formatted = Math.abs(num).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
    if (showSign) {
      return num > 0 ? `+${formatted}` : num < 0 ? `-${formatted}` : formatted;
    }
    return formatted;
  }

  function formatMoneyDetailed(amount) {
    const num = Number(amount) || 0;
    return num.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.className = 'toast';
    }, 2500);
  }

  // Authentication Management
  function getAuthToken() {
    return localStorage.getItem('kyros_auth_token') || '';
  }

  function setAuthToken(token) {
    if (token) {
      localStorage.setItem('kyros_auth_token', token);
    } else {
      localStorage.removeItem('kyros_auth_token');
    }
  }

  function showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (appContainer) appContainer.style.display = 'none';
  }

  function showAppContainer() {
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (appContainer) appContainer.style.display = 'block';
  }

  function handleLogout() {
    setAuthToken(null);
    showLoginScreen();
    showToast('Signed out safely', 'info');
  }

  // API Call helper
  async function apiFetch(endpoint, options = {}) {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers
      });

      if (res.status === 401) {
        setAuthToken(null);
        showLoginScreen();
        throw new Error('Unauthorized or session expired. Please log in.');
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      showToast(err.message, 'error');
      throw err;
    }
  }

  // DOM Elements
  const activeMonthDisplay = document.getElementById('activeMonthDisplay');
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  const currentMonthBtn = document.getElementById('currentMonthBtn');

  // Mission Elements
  const missionSubtitle = document.getElementById('missionSubtitle');
  const incomeGaugeCircle = document.getElementById('incomeGaugeCircle');
  const incomeGaugePct = document.getElementById('incomeGaugePct');
  const incomeGaugeCurrent = document.getElementById('incomeGaugeCurrent');
  const incomeGaugeTarget = document.getElementById('incomeGaugeTarget');
  const incomeGaugeDelta = document.getElementById('incomeGaugeDelta');

  const portfolioGaugeCircle = document.getElementById('portfolioGaugeCircle');
  const portfolioGaugePct = document.getElementById('portfolioGaugePct');
  const portfolioGaugeCurrent = document.getElementById('portfolioGaugeCurrent');
  const portfolioGaugeTarget = document.getElementById('portfolioGaugeTarget');
  const portfolioGaugeDelta = document.getElementById('portfolioGaugeDelta');

  const urgencyText = document.getElementById('urgencyText');

  // KPI Cards
  const cardThisMonthIncome = document.getElementById('cardThisMonthIncome');
  const cardThisMonthCost = document.getElementById('cardThisMonthCost');
  const cardThisMonthProfit = document.getElementById('cardThisMonthProfit');

  const cardLastMonthIncome = document.getElementById('cardLastMonthIncome');
  const cardLastMonthCost = document.getElementById('cardLastMonthCost');
  const cardLastMonthProfit = document.getElementById('cardLastMonthProfit');

  const cardThisYearIncome = document.getElementById('cardThisYearIncome');
  const cardThisYearCost = document.getElementById('cardThisYearCost');
  const cardThisYearProfit = document.getElementById('cardThisYearProfit');

  const cardLastYearIncome = document.getElementById('cardLastYearIncome');
  const cardLastYearCost = document.getElementById('cardLastYearCost');
  const cardLastYearProfit = document.getElementById('cardLastYearProfit');

  const cardLifetimeIncome = document.getElementById('cardLifetimeIncome');
  const cardLifetimeProfit = document.getElementById('cardLifetimeProfit');
  const cardLifetimeCost = document.getElementById('cardLifetimeCost');

  // Analytics
  const incomeMixMonthLabel = document.getElementById('incomeMixMonthLabel');
  const incomeMixTotalLabel = document.getElementById('incomeMixTotalLabel');
  const incomeMixSvg = document.getElementById('incomeMixSvg');
  const donutCenterTotal = document.getElementById('donutCenterTotal');
  const mixAdsVal = document.getElementById('mixAdsVal');
  const mixAmazonVal = document.getElementById('mixAmazonVal');
  const mixOtherVal = document.getElementById('mixOtherVal');

  const trendChartContainer = document.getElementById('trendChartContainer');
  const trendYearBadge = document.getElementById('trendYearBadge');

  // Status Badges
  const badgeRunningCount = document.getElementById('badgeRunningCount');
  const badgePenaltyCount = document.getElementById('badgePenaltyCount');
  const badgeDeletedCount = document.getElementById('badgeDeletedCount');
  const badgeSoldCount = document.getElementById('badgeSoldCount');
  const badgeAllCount = document.getElementById('badgeAllCount');

  // Sites Table
  const sitesHeaderCount = document.getElementById('sitesHeaderCount');
  const siteSearchInput = document.getElementById('siteSearchInput');
  const sitesTableBody = document.getElementById('sitesTableBody');
  const tablePaginationInfo = document.getElementById('tablePaginationInfo');
  const tablePrevPageBtn = document.getElementById('tablePrevPageBtn');
  const tableNextPageBtn = document.getElementById('tableNextPageBtn');
  const tablePageNumber = document.getElementById('tablePageNumber');

  // Expenses Ledger
  const expensesCountBadge = document.getElementById('expensesCountBadge');
  const ledgerTotalDisplay = document.getElementById('ledgerTotalDisplay');
  const ledgerEntriesCount = document.getElementById('ledgerEntriesCount');
  const expensesTableBody = document.getElementById('expensesTableBody');

  // Top Sites & Targets
  const topSitesMonthLabel = document.getElementById('topSitesMonthLabel');
  const topSitesContainer = document.getElementById('topSitesContainer');
  const targetsForm = document.getElementById('targetsForm');
  const inputGoalSites = document.getElementById('inputGoalSites');
  const inputGoalIncome = document.getElementById('inputGoalIncome');

  // Modals
  const addSiteModal = document.getElementById('addSiteModal');
  const openAddSiteModalBtn = document.getElementById('openAddSiteModalBtn');
  const addSiteForm = document.getElementById('addSiteForm');

  const addCostModal = document.getElementById('addCostModal');
  const openAddCostModalBtn = document.getElementById('openAddCostModalBtn');
  const addCostForm = document.getElementById('addCostForm');
  const newCostSiteId = document.getElementById('newCostSiteId');

  const restoreModal = document.getElementById('restoreModal');
  const openRestoreBtn = document.getElementById('openRestoreBtn');
  const restoreFileInput = document.getElementById('restoreFileInput');
  const executeRestoreBtn = document.getElementById('executeRestoreBtn');

  // Edit Site Modal
  const editSiteModal = document.getElementById('editSiteModal');
  const editSiteForm = document.getElementById('editSiteForm');
  const editSiteId = document.getElementById('editSiteId');
  const editSiteUrl = document.getElementById('editSiteUrl');
  const editSiteName = document.getElementById('editSiteName');
  const editSiteUsername = document.getElementById('editSiteUsername');
  const editSiteStatus = document.getElementById('editSiteStatus');

  // Theme Engine (Light, Dark, System)
  function applyTheme(themeChoice) {
    state.theme = themeChoice;
    const systemIsDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effectiveTheme = themeChoice === 'system' ? (systemIsDark ? 'dark' : 'light') : themeChoice;

    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${effectiveTheme}`);
    document.documentElement.setAttribute('data-theme', effectiveTheme);

    // Update buttons in UI
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === themeChoice);
    });

    // Re-render donut if summary exists
    if (state.summary && state.summary.incomeMix) {
      renderIncomeMixDonut(state.summary.incomeMix);
    }
  }

  function setupAuthHandlers() {
    const loginForm = document.getElementById('loginForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    const loginErrorText = document.getElementById('loginErrorText');
    const loginSubmitBtn = document.getElementById('loginSubmitBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (togglePasswordBtn && loginPassword) {
      togglePasswordBtn.addEventListener('click', () => {
        const isPassword = loginPassword.type === 'password';
        loginPassword.type = isPassword ? 'text' : 'password';
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
    }

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');
        loginSubmitBtn.disabled = true;
        if (loginBtnText) loginBtnText.textContent = 'Verifying...';

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: loginEmail.value.trim(),
              password: loginPassword.value
            })
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Invalid credentials');
          }

          setAuthToken(data.token);
          loginPassword.value = '';
          showAppContainer();
          setupEventListeners();
          showToast('Authenticated! Welcome Boss TN TAYYAB 👑');
          await loadAllData();
        } catch (err) {
          loginErrorText.textContent = err.message || 'Invalid credentials';
          loginError.classList.remove('hidden');
        } finally {
          loginSubmitBtn.disabled = false;
          if (loginBtnText) loginBtnText.textContent = 'Authenticate & Enter';
        }
      });
    }
  }

  // Init Data Fetching
  async function init() {
    applyTheme(state.theme);

    // Listen for OS system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (state.theme === 'system') {
          applyTheme('system');
        }
      });
    }

    setupAuthHandlers();

    const token = getAuthToken();
    if (!token) {
      showLoginScreen();
      return;
    }

    try {
      const res = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Session invalid');
      showAppContainer();
      setupEventListeners();
      await loadAllData();
    } catch {
      setAuthToken(null);
      showLoginScreen();
    }
  }

  async function loadAllData() {
    activeMonthDisplay.textContent = formatMonthLabel(state.activeMonth);
    await Promise.all([
      loadSummary(),
      loadSites(),
      loadExpenses()
    ]);
  }

  // Load Mission Summary
  async function loadSummary() {
    const data = await apiFetch(`/api/mission/summary?month=${state.activeMonth}`);
    if (!data || !data.success) return;
    state.summary = data;
    renderSummary();
  }

  function renderSummary() {
    const s = state.summary;
    if (!s) return;

    // Mission Subtitle & Targets
    missionSubtitle.textContent = `${s.goalSites.toLocaleString()} sites — $${s.goalMonthlyIncome.toLocaleString()} every month`;
    inputGoalSites.value = s.goalSites;
    inputGoalIncome.value = s.goalMonthlyIncome;

    // Monthly Income Gauge
    const currentIncome = s.thisMonth.income || 0;
    const targetIncome = s.goalMonthlyIncome || 15000;
    const incomePct = targetIncome > 0 ? Math.min(100, Math.round((currentIncome / targetIncome) * 100)) : 0;
    const circumference = 2 * Math.PI * 34; // 213.6
    const incomeOffset = circumference - (incomePct / 100) * circumference;
    incomeGaugeCircle.style.strokeDashoffset = incomeOffset;
    incomeGaugePct.textContent = `${incomePct}%`;
    incomeGaugeCurrent.textContent = formatMoney(currentIncome);
    incomeGaugeTarget.textContent = `of ${formatMoney(targetIncome)}`;
    
    const remainingIncome = Math.max(0, targetIncome - currentIncome);
    incomeGaugeDelta.textContent = remainingIncome === 0 ? 'Goal reached! 🎉' : `+${formatMoney(remainingIncome)} to go`;

    // Portfolio Goal Gauge
    const runningCount = s.statusCounts.running || 0;
    const targetSites = s.goalSites || 500;
    const portPct = targetSites > 0 ? Math.min(100, Math.round((runningCount / targetSites) * 100)) : 0;
    const portOffset = circumference - (portPct / 100) * circumference;
    portfolioGaugeCircle.style.strokeDashoffset = portOffset;
    portfolioGaugePct.textContent = `${portPct}%`;
    portfolioGaugeCurrent.textContent = `${runningCount} running`;
    portfolioGaugeTarget.textContent = `of ${targetSites} sites`;
    
    const remainingSites = Math.max(0, targetSites - runningCount);
    portfolioGaugeDelta.textContent = remainingSites === 0 ? 'Portfolio goal achieved! 🚀' : `${remainingSites} sites to go`;

    // Urgency Banner
    const daysLeft = s.daysLeft || 1;
    const dailyNeeded = s.dailyRunRateNeeded || 0;
    const monthName = formatMonthLabel(s.month);
    if (remainingIncome > 0) {
      urgencyText.innerHTML = `<strong>${daysLeft} days left in ${monthName}</strong> — earn <strong>${formatMoney(dailyNeeded)}/day</strong> to hit the monthly goal.`;
    } else {
      urgencyText.innerHTML = `🔥 <strong>Incredible performance!</strong> Monthly goal of ${formatMoney(targetIncome)} achieved for ${monthName}!`;
    }

    // 6 Financial KPI Cards
    renderKpiCard(cardThisMonthIncome, cardThisMonthCost, cardThisMonthProfit, s.thisMonth);
    renderKpiCard(cardLastMonthIncome, cardLastMonthCost, cardLastMonthProfit, s.lastMonth);
    renderKpiCard(cardThisYearIncome, cardThisYearCost, cardThisYearProfit, s.thisYear);
    renderKpiCard(cardLastYearIncome, cardLastYearCost, cardLastYearProfit, s.lastYear);

    cardLifetimeIncome.textContent = formatMoney(s.lifetime.income);
    cardLifetimeProfit.textContent = formatMoney(s.lifetime.profit, true);
    cardLifetimeCost.textContent = formatMoney(s.lifetime.cost);

    // Status Badges
    badgeRunningCount.textContent = s.statusCounts.running || 0;
    badgePenaltyCount.textContent = s.statusCounts.penalty || 0;
    badgeDeletedCount.textContent = s.statusCounts.deleted || 0;
    badgeSoldCount.textContent = s.statusCounts.sold || 0;
    badgeAllCount.textContent = s.totalSites || 0;

    // Income Mix
    incomeMixMonthLabel.textContent = formatMonthLabel(s.month);
    incomeMixTotalLabel.textContent = formatMoney(s.incomeMix.total);
    donutCenterTotal.textContent = formatMoney(s.incomeMix.total);
    mixAdsVal.textContent = formatMoney(s.incomeMix.ads);
    mixAmazonVal.textContent = formatMoney(s.incomeMix.amazon);
    mixOtherVal.textContent = formatMoney(s.incomeMix.other);
    renderIncomeMixDonut(s.incomeMix);

    // 12-Month Performance Trend Chart
    trendYearBadge.textContent = `${formatMoney(s.thisYear.income)} this year`;
    render12MonthTrend(s.trend12Months);

    // Top Sites
    topSitesMonthLabel.textContent = `Highest income in ${formatMonthLabel(s.month)}`;
    renderTopSites(s.topSites);
  }

  function renderKpiCard(incomeEl, costEl, profitEl, metric) {
    incomeEl.textContent = formatMoney(metric.income);
    costEl.textContent = `Cost ${formatMoney(metric.cost)}`;
    profitEl.textContent = formatMoney(metric.profit, true);
    if (metric.profit > 0) {
      profitEl.className = 'font-bold font-mono text-emerald-400';
    } else if (metric.profit < 0) {
      profitEl.className = 'font-bold font-mono text-rose-400';
    } else {
      profitEl.className = 'font-bold font-mono text-slate-400';
    }
  }

  // Render Income Mix Donut
  function renderIncomeMixDonut(mix) {
    const total = mix.total || 0;
    const r = 30;
    const c = 2 * Math.PI * r; // ~188.5
    const trackColor = getComputedStyle(document.documentElement).getPropertyValue('--chart-track').trim() || '#1e293b';
    
    if (total === 0) {
      incomeMixSvg.innerHTML = `
        <circle cx="88" cy="88" r="${r}" stroke="${trackColor}" stroke-width="12" fill="none" />
      `;
      return;
    }

    const adsPct = mix.ads / total;
    const amzPct = mix.amazon / total;
    const othPct = mix.other / total;

    const adsLen = adsPct * c;
    const amzLen = amzPct * c;
    const othLen = othPct * c;

    let offset = 0;
    let circlesHtml = `
      <circle cx="88" cy="88" r="${r}" stroke="${trackColor}" stroke-width="12" fill="none" />
    `;

    if (adsLen > 0) {
      circlesHtml += `
        <circle cx="88" cy="88" r="${r}" stroke="#22d3ee" stroke-width="12" fill="none"
          stroke-dasharray="${adsLen} ${c - adsLen}" stroke-dashoffset="${-offset}" />
      `;
      offset += adsLen;
    }

    if (amzLen > 0) {
      circlesHtml += `
        <circle cx="88" cy="88" r="${r}" stroke="#fbbf24" stroke-width="12" fill="none"
          stroke-dasharray="${amzLen} ${c - amzLen}" stroke-dashoffset="${-offset}" />
      `;
      offset += amzLen;
    }

    if (othLen > 0) {
      circlesHtml += `
        <circle cx="88" cy="88" r="${r}" stroke="#a855f7" stroke-width="12" fill="none"
          stroke-dasharray="${othLen} ${c - othLen}" stroke-dashoffset="${-offset}" />
      `;
    }

    incomeMixSvg.innerHTML = circlesHtml;
  }

  // Render 12-Month Performance Trend Chart
  function render12MonthTrend(trendMonths) {
    if (!trendMonths || trendMonths.length === 0) return;
    
    // Find max value to scale heights
    let maxVal = 100;
    trendMonths.forEach(m => {
      maxVal = Math.max(maxVal, m.income, m.cost);
    });

    trendChartContainer.innerHTML = '';
    const maxBarHeight = 120; // px

    trendMonths.forEach(m => {
      const col = document.createElement('div');
      col.className = 'flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer';

      const incomeHeight = Math.max(4, (m.income / maxVal) * maxBarHeight);
      const costHeight = Math.max(4, (m.cost / maxVal) * maxBarHeight);

      const isActive = m.month_key === state.activeMonth;

      col.innerHTML = `
        <div class="w-full flex items-end justify-center gap-1">
          <div class="w-2.5 rounded-t transition-all duration-300 ${isActive ? 'bg-brand-400 ring-2 ring-brand-300' : 'bg-brand-500/80 group-hover:bg-brand-400'}" style="height: ${incomeHeight}px;" title="Income: ${formatMoney(m.income)}"></div>
          <div class="w-2.5 rounded-t transition-all duration-300 ${isActive ? 'bg-rose-400 ring-2 ring-rose-300' : 'bg-rose-500/70 group-hover:bg-rose-400'}" style="height: ${costHeight}px;" title="Cost: ${formatMoney(m.cost)}"></div>
        </div>
        <span class="text-[10px] font-mono mt-2 transition-colors ${isActive ? 'text-brand-300 font-bold' : 'text-slate-400 group-hover:text-white'}">
          ${m.label.split(' ')[0]}
        </span>

        <!-- Hover Tooltip -->
        <div class="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-slate-900 border border-border p-2 rounded-lg text-[11px] shadow-xl z-20 pointer-events-none whitespace-nowrap font-mono">
          <span class="font-bold text-white mb-0.5">${m.label}</span>
          <span class="text-brand-300">Income: ${formatMoney(m.income)}</span>
          <span class="text-rose-300">Cost: ${formatMoney(m.cost)}</span>
          <span class="${m.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-bold">Profit: ${formatMoney(m.profit, true)}</span>
        </div>
      `;

      col.addEventListener('click', () => {
        state.activeMonth = m.month_key;
        loadAllData();
      });

      trendChartContainer.appendChild(col);
    });
  }

  // Render Top Sites Leaderboard
  function renderTopSites(topSites) {
    if (!topSites || topSites.length === 0) {
      topSitesContainer.innerHTML = `
        <div class="text-xs text-slate-500 italic py-6 text-center">
          No revenue recorded yet for ${formatMonthLabel(state.activeMonth)}. Enter numbers in the table above!
        </div>
      `;
      return;
    }

    let html = '';
    topSites.forEach((site, index) => {
      const medals = ['🥇', '🥈', '🥉', '4.', '5.'];
      html += `
        <div class="flex items-center justify-between p-2.5 rounded-lg bg-dark/60 border border-border/70 hover:border-border transition">
          <div class="flex items-center gap-3">
            <span class="text-sm font-bold">${medals[index] || (index + 1) + '.'}</span>
            <div>
              <a href="${site.site_url}" target="_blank" class="text-xs font-semibold text-white hover:text-brand-400 transition flex items-center gap-1">
                ${site.site_name || site.site_url}
                <span class="text-[10px] text-slate-500">↗</span>
              </a>
              <span class="text-[11px] text-slate-400">${site.username || 'Author'} • Ads: ${formatMoney(site.ads)} • Amz: ${formatMoney(site.amazon)}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-xs font-bold font-mono text-emerald-400">${formatMoney(site.total_income)}</div>
            <div class="text-[10px] font-mono text-slate-400">Profit: ${formatMoney(site.profit, true)}</div>
          </div>
        </div>
      `;
    });
    topSitesContainer.innerHTML = html;
  }

  // Load Sites
  async function loadSites() {
    const data = await apiFetch(`/api/sites?month=${state.activeMonth}&status=${state.activeStatusFilter}&search=${encodeURIComponent(state.searchQuery)}`);
    if (!data || !data.success) return;
    state.sites = data.sites || [];
    renderSitesTable();
    populateSiteDropdown();
  }

  function renderSitesTable() {
    sitesHeaderCount.textContent = state.sites.length;
    
    // Pagination
    const total = state.sites.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = Math.min(state.page, totalPages);

    const startIdx = (state.page - 1) * state.pageSize;
    const endIdx = Math.min(startIdx + state.pageSize, total);
    const pageSites = state.sites.slice(startIdx, endIdx);

    tablePaginationInfo.textContent = total > 0 ? `Showing ${startIdx + 1}-${endIdx} of ${total} sites` : '0 sites found';
    tablePageNumber.textContent = state.page;
    tablePrevPageBtn.disabled = state.page <= 1;
    tableNextPageBtn.disabled = state.page >= totalPages;

    if (pageSites.length === 0) {
      sitesTableBody.innerHTML = `
        <tr>
          <td colspan="11" class="text-center py-10 text-slate-400 italic">
            No websites match your filter or search criteria.
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = '';
    pageSites.forEach((site, i) => {
      const rowIndex = startIdx + i + 1;
      const profitClass = site.profit > 0 ? 'text-emerald-400 font-bold' : site.profit < 0 ? 'text-rose-400 font-bold' : 'text-slate-400';
      const isNearBottom = pageSites.length > 2 && i >= pageSites.length - 2;

      const statusColors = {
        running: 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30',
        penalty: 'bg-amber-950/60 text-amber-400 border-amber-500/30',
        deleted: 'bg-rose-950/60 text-rose-400 border-rose-500/30',
        sold: 'bg-slate-800 text-slate-300 border-slate-700'
      };

      rowsHtml += `
        <tr class="hover:bg-card-alt/50 transition-colors group" data-site-id="${site.id}">
          <td class="py-2.5 px-3 text-center font-mono text-slate-400">${rowIndex}</td>
          <td class="py-2.5 px-4">
            <a href="${site.site_url}" target="_blank" class="font-bold text-white hover:text-brand-400 transition inline-flex items-center gap-1 text-xs tracking-tight" title="${site.site_url}">
              <span>${site.site_name || site.site_url}</span>
              <span class="text-[10px] text-slate-500 hover:text-brand-400 transition">↗</span>
            </a>
            <div class="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 font-medium">
              <span class="text-slate-500">👤</span>
              <span class="site-username-display">${site.username || '<span class="text-slate-600">No author</span>'}</span>
            </div>
          </td>
          <td class="py-2.5 px-3">
            <select class="site-status-select px-2.5 py-1 rounded-md text-[11px] font-semibold border ${statusColors[site.status] || statusColors.running} bg-transparent outline-none cursor-pointer" data-id="${site.id}">
              <option value="running" ${site.status === 'running' ? 'selected' : ''}>Running</option>
              <option value="penalty" ${site.status === 'penalty' ? 'selected' : ''}>Penalty</option>
              <option value="deleted" ${site.status === 'deleted' ? 'selected' : ''}>Deleted</option>
              <option value="sold" ${site.status === 'sold' ? 'selected' : ''}>Sold</option>
            </select>
          </td>
          <td class="py-2.5 px-3 text-right">
            <input type="number" step="0.01" class="table-input metric-input text-cyan-400 font-bold" data-field="ads_income" data-id="${site.id}" value="${site.ads_income || 0}">
          </td>
          <td class="py-2.5 px-3 text-right">
            <input type="number" step="0.01" class="table-input metric-input text-amber-400 font-bold" data-field="amazon_income" data-id="${site.id}" value="${site.amazon_income || 0}">
          </td>
          <td class="py-2.5 px-3 text-right font-mono font-bold text-white">
            ${formatMoney(site.total_income)}
          </td>
          <td class="py-2.5 px-3 text-right font-mono ${profitClass}">
            ${formatMoney(site.profit, true)}
          </td>
          <td class="py-2.5 px-3 text-center">
            <div class="action-dropdown-container">
              <button type="button" class="action-menu-btn" data-id="${site.id}" title="Actions">
                <svg class="w-4 h-4 pointer-events-none" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                </svg>
              </button>
              <div class="action-dropdown-menu hidden ${isNearBottom ? 'bottom-full mb-1.5' : 'top-full mt-1.5'}" data-menu-id="${site.id}">
                <button type="button" class="dropdown-item edit-site-opt" data-id="${site.id}">
                  <span class="text-sm">✏️</span>
                  <span>Edit Site</span>
                </button>
                <a href="${site.site_url}" target="_blank" class="dropdown-item">
                  <span class="text-sm">🌐</span>
                  <span>Visit Website</span>
                </a>
                <button type="button" class="dropdown-item copy-url-opt" data-url="${site.site_url}">
                  <span class="text-sm">📋</span>
                  <span>Copy URL</span>
                </button>
                <div class="dropdown-divider"></div>
                <button type="button" class="dropdown-item text-rose-400 delete-site-opt" data-id="${site.id}">
                  <span class="text-sm">🗑️</span>
                  <span>Delete Site</span>
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
    });

    sitesTableBody.innerHTML = rowsHtml;
    attachTableInputEvents();
  }

  function closeAllActionMenus() {
    if (!sitesTableBody) return;
    sitesTableBody.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.add('hidden'));
    sitesTableBody.querySelectorAll('.action-menu-btn').forEach(b => b.classList.remove('active'));
  }

  function attachTableInputEvents() {
    // Close menus if any open
    closeAllActionMenus();

    // Metric inputs inline auto-save
    const inputs = sitesTableBody.querySelectorAll('.metric-input');
    inputs.forEach(input => {
      input.addEventListener('change', async (e) => {
        const siteId = parseInt(e.target.dataset.id, 10);
        const row = e.target.closest('tr');
        await saveRowMetrics(row, siteId);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      });
    });

    // 3-dot action menu toggle
    const menuBtns = sitesTableBody.querySelectorAll('.action-menu-btn');
    menuBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const siteId = btn.dataset.id;
        const menu = sitesTableBody.querySelector(`.action-dropdown-menu[data-menu-id="${siteId}"]`);
        
        // Close other menus first
        sitesTableBody.querySelectorAll('.action-dropdown-menu').forEach(m => {
          if (m !== menu) m.classList.add('hidden');
        });
        sitesTableBody.querySelectorAll('.action-menu-btn').forEach(b => {
          if (b !== btn) b.classList.remove('active');
        });

        if (menu) {
          const willOpen = menu.classList.contains('hidden');
          menu.classList.toggle('hidden', !willOpen);
          btn.classList.toggle('active', willOpen);
        }
      });
    });

    // Edit site option inside dropdown
    const editOpts = sitesTableBody.querySelectorAll('.edit-site-opt');
    editOpts.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllActionMenus();
        const siteId = parseInt(btn.dataset.id, 10);
        const site = state.sites.find(s => s.id === siteId);
        if (!site) return;
        editSiteId.value = site.id;
        editSiteUrl.value = site.site_url;
        editSiteName.value = site.site_name || '';
        editSiteUsername.value = site.username || '';
        editSiteStatus.value = site.status || 'running';
        editSiteModal.classList.remove('hidden');
      });
    });

    // Copy URL option inside dropdown
    const copyOpts = sitesTableBody.querySelectorAll('.copy-url-opt');
    copyOpts.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        closeAllActionMenus();
        const url = btn.dataset.url;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
          } else {
            const ta = document.createElement('textarea');
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
          }
          showToast('URL copied to clipboard 📋');
        } catch (err) {
          showToast('Failed to copy URL');
        }
      });
    });

    // Delete site option inside dropdown
    const deleteOpts = sitesTableBody.querySelectorAll('.delete-site-opt');
    deleteOpts.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        closeAllActionMenus();
        const siteId = parseInt(btn.dataset.id, 10);
        const site = state.sites.find(s => s.id === siteId);
        const name = site ? (site.site_name || site.site_url) : 'this site';
        if (confirm(`Are you sure you want to delete ${name}? This will remove all associated monthly metrics.`)) {
          await apiFetch(`/api/sites/${siteId}`, { method: 'DELETE' });
          showToast('Site deleted ✓');
          await Promise.all([loadSummary(), loadSites()]);
        }
      });
    });

    // Status change
    const statusSelects = sitesTableBody.querySelectorAll('.site-status-select');
    statusSelects.forEach(select => {
      select.addEventListener('change', async (e) => {
        const siteId = parseInt(e.target.dataset.id, 10);
        const newStatus = e.target.value;
        await apiFetch(`/api/sites/${siteId}`, {
          method: 'PUT',
          body: JSON.stringify({ status: newStatus })
        });
        showToast('Site status updated ✓');
        await Promise.all([loadSummary(), loadSites()]);
      });
    });
  }

  async function saveRowMetrics(row, siteId) {
    const site = state.sites.find(s => s.id === siteId) || {};
    const articles = site.articles_count || 0;
    const cost = site.cost || 0;

    const adsInput = row.querySelector('[data-field="ads_income"]');
    const amazonInput = row.querySelector('[data-field="amazon_income"]');
    const ads = adsInput ? parseFloat(adsInput.value) || 0 : 0;
    const amazon = amazonInput ? parseFloat(amazonInput.value) || 0 : 0;

    await apiFetch('/api/metrics/update', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        month_key: state.activeMonth,
        articles_count: articles,
        cost,
        ads_income: ads,
        amazon_income: amazon,
        other_income: 0
      })
    });

    showToast('Saved to Database ✓');
    await Promise.all([loadSummary(), loadSites()]);
  }

  // Populate Site dropdown in Add Expense modal
  function populateSiteDropdown() {
    newCostSiteId.innerHTML = '<option value="">Global / Operations (General)</option>';
    state.sites.forEach(site => {
      const opt = document.createElement('option');
      opt.value = site.id;
      opt.textContent = site.site_name || site.site_url;
      newCostSiteId.appendChild(opt);
    });
  }

  // Load Expenses Ledger
  async function loadExpenses() {
    const data = await apiFetch(`/api/expenses?month=${state.activeMonth}&range=${state.ledgerRange}`);
    if (!data || !data.success) return;
    state.expenses = data.expenses || [];
    renderExpensesLedger(data.totalAmount, data.count);
  }

  function renderExpensesLedger(totalAmount, count) {
    expensesCountBadge.textContent = count;
    ledgerEntriesCount.textContent = `${count} entries`;
    ledgerTotalDisplay.textContent = formatMoneyDetailed(totalAmount);

    if (state.expenses.length === 0) {
      expensesTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-8 text-slate-500 italic">
            No expenses logged in this range. Click "+ Add Cost" to record hosting, domains, articles, or tools.
          </td>
        </tr>
      `;
      return;
    }

    const categoryLabels = {
      hosting: '☁️ Hosting & Cloud',
      domain: '🌐 Domain Names',
      content: '✍️ Writers & Content',
      tools_ai: '⚡ AI & Subscriptions',
      plugins: '🧩 Plugins & Themes',
      va_team: '👥 VA & Team',
      marketing: '🚀 Marketing & Links',
      miscellaneous: '📦 Miscellaneous'
    };

    let html = '';
    state.expenses.forEach((e, i) => {
      html += `
        <tr class="hover:bg-card-alt/50 transition-colors">
          <td class="py-2.5 px-3 text-center font-mono text-slate-500">${i + 1}</td>
          <td class="py-2.5 px-3 font-mono text-slate-300">${e.expense_date}</td>
          <td class="py-2.5 px-3">
            <span class="px-2 py-0.5 rounded text-[11px] font-medium bg-dark border border-border text-slate-300">
              ${categoryLabels[e.category] || e.category}
            </span>
          </td>
          <td class="py-2.5 px-3 font-semibold text-white">${e.title}</td>
          <td class="py-2.5 px-3 text-slate-400">${e.site_name || 'Global'}</td>
          <td class="py-2.5 px-3 text-right font-mono font-bold text-rose-400">${formatMoneyDetailed(e.amount)}</td>
          <td class="py-2.5 px-3 text-center">
            <button class="delete-expense-btn btn-icon text-slate-500 hover:text-rose-400" data-id="${e.id}" title="Delete expense">
              ✕
            </button>
          </td>
        </tr>
      `;
    });

    expensesTableBody.innerHTML = html;

    // Attach delete handlers
    expensesTableBody.querySelectorAll('.delete-expense-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (confirm('Delete this expense entry?')) {
          await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
          showToast('Expense removed ✓');
          await Promise.all([loadSummary(), loadExpenses()]);
        }
      });
    });
  }

  // Setup Event Listeners
  function setupEventListeners() {
    if (state.listenersAttached) return;
    state.listenersAttached = true;

    // Theme Switcher Buttons (Light / Dark / System)
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedTheme = btn.dataset.theme;
        localStorage.setItem('kyros_theme', selectedTheme);
        applyTheme(selectedTheme);
        const labels = { light: 'Light ☀️', dark: 'Dark 🌙', system: 'System 💻' };
        showToast(`Theme switched to ${labels[selectedTheme] || selectedTheme} ✓`);
      });
    });

    // Month Navigator
    prevMonthBtn.addEventListener('click', () => {
      const [y, m] = state.activeMonth.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 2, 1));
      state.activeMonth = d.toISOString().slice(0, 7);
      loadAllData();
    });

    nextMonthBtn.addEventListener('click', () => {
      const [y, m] = state.activeMonth.split('-').map(Number);
      const d = new Date(Date.UTC(y, m, 1));
      state.activeMonth = d.toISOString().slice(0, 7);
      loadAllData();
    });

    currentMonthBtn.addEventListener('click', () => {
      state.activeMonth = getCurrentMonthKey();
      loadAllData();
    });

    // Status Filter Badges
    document.querySelectorAll('.status-badge').forEach(badge => {
      badge.addEventListener('click', () => {
        document.querySelectorAll('.status-badge').forEach(b => b.classList.remove('active'));
        badge.classList.add('active');
        state.activeStatusFilter = badge.dataset.status;
        state.page = 1;
        loadSites();
      });
    });

    // Search Input
    let searchDebounce;
    siteSearchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.searchQuery = e.target.value;
        state.page = 1;
        loadSites();
      }, 250);
    });

    // Pagination
    tablePrevPageBtn.addEventListener('click', () => {
      if (state.page > 1) {
        state.page--;
        renderSitesTable();
      }
    });

    tableNextPageBtn.addEventListener('click', () => {
      state.page++;
      renderSitesTable();
    });

    // Ledger Range Tabs
    document.querySelectorAll('.ledger-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.ledger-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.ledgerRange = tab.dataset.range;
        loadExpenses();
      });
    });

    // Targets Form
    targetsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const goalSites = parseInt(inputGoalSites.value, 10);
      const goalMonthlyIncome = parseFloat(inputGoalIncome.value);

      await apiFetch('/api/targets', {
        method: 'POST',
        body: JSON.stringify({ goalSites, goalMonthlyIncome })
      });

      showToast('Mission targets updated ✓');
      await loadSummary();
    });

    // Modals open/close
    openAddSiteModalBtn.addEventListener('click', () => {
      addSiteModal.classList.remove('hidden');
    });

    openAddCostModalBtn.addEventListener('click', () => {
      document.getElementById('newCostDate').value = new Date().toISOString().slice(0, 10);
      addCostModal.classList.remove('hidden');
    });

    openRestoreBtn.addEventListener('click', () => {
      restoreModal.classList.remove('hidden');
    });

    function closeAllModals() {
      addSiteModal.classList.add('hidden');
      editSiteModal.classList.add('hidden');
      addCostModal.classList.add('hidden');
      restoreModal.classList.add('hidden');
    }

    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeAllModals();
      });
    });

    // Close on backdrop click (click outside modal box)
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          closeAllModals();
        }
      });
    });

    // Close on Escape key press
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllModals();
        closeAllActionMenus();
      }
    });

    // Close 3-dot dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.action-dropdown-container')) {
        closeAllActionMenus();
      }
    });

    // Add Site Form Submit
    addSiteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const siteName = document.getElementById('newSiteName').value.trim();
      const url = document.getElementById('newSiteUrl').value.trim();
      const username = document.getElementById('newSiteUsername').value.trim();
      const status = document.getElementById('newSiteStatus').value;
      const ads = parseFloat(document.getElementById('newSiteAds').value) || 0;
      const amazon = parseFloat(document.getElementById('newSiteAmazon').value) || 0;

      await apiFetch('/api/sites', {
        method: 'POST',
        body: JSON.stringify({
          site_name: siteName,
          site_url: url,
          username,
          status,
          articles_count: 0,
          ads_income: ads,
          amazon_income: amazon,
          month_key: state.activeMonth
        })
      });

      showToast('New site added to database ✓');
      addSiteModal.classList.add('hidden');
      addSiteForm.reset();
      await Promise.all([loadSummary(), loadSites()]);
    });

    // Edit Site Form Submit
    editSiteForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const siteId = editSiteId.value;
      const siteUrl = editSiteUrl.value.trim();
      const siteName = editSiteName.value.trim();
      const username = editSiteUsername.value.trim();
      const status = editSiteStatus.value;

      await apiFetch(`/api/sites/${siteId}`, {
        method: 'PUT',
        body: JSON.stringify({
          site_url: siteUrl,
          site_name: siteName,
          username: username,
          status: status
        })
      });

      showToast('Site details updated successfully ✓');
      editSiteModal.classList.add('hidden');
      await Promise.all([loadSummary(), loadSites()]);
    });

    // Add Expense Form Submit
    addCostForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = document.getElementById('newCostDate').value;
      const category = document.getElementById('newCostCategory').value;
      const title = document.getElementById('newCostTitle').value;
      const amount = parseFloat(document.getElementById('newCostAmount').value);
      const siteId = document.getElementById('newCostSiteId').value;

      await apiFetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          expense_date: date,
          category,
          title,
          amount,
          site_id: siteId || null,
          month_key: state.activeMonth
        })
      });

      showToast('Expense recorded in ledger ✓');
      addCostModal.classList.add('hidden');
      addCostForm.reset();
      await Promise.all([loadSummary(), loadExpenses()]);
    });

    // CSV Exports (Authenticated)
    document.getElementById('exportCsvBtn').addEventListener('click', () => {
      const token = getAuthToken();
      window.location.href = `/api/export/csv?type=sites&month=${state.activeMonth}&token=${encodeURIComponent(token)}`;
    });

    document.getElementById('exportExpensesCsvBtn').addEventListener('click', () => {
      const token = getAuthToken();
      window.location.href = `/api/export/csv?type=expenses&token=${encodeURIComponent(token)}`;
    });

    // JSON Backup Download (Authenticated)
    document.getElementById('backupBtn').addEventListener('click', () => {
      const token = getAuthToken();
      window.location.href = `/api/backup/export?token=${encodeURIComponent(token)}`;
      showToast('Backup snapshot generated ✓');
    });

    // Database Restore
    executeRestoreBtn.addEventListener('click', async () => {
      const file = restoreFileInput.files[0];
      if (!file) {
        alert('Please choose a valid backup JSON file first.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          await apiFetch('/api/backup/restore', {
            method: 'POST',
            body: JSON.stringify(parsed)
          });
          showToast('Database restored successfully! Reloading...');
          restoreModal.classList.add('hidden');
          setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
          alert('Failed to parse or restore backup: ' + err.message);
        }
      };
      reader.readAsText(file);
    });
  }

  // Start
  document.addEventListener('DOMContentLoaded', init);
})();
