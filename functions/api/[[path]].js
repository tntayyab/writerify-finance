// Cloudflare Pages Functions API adapter for Supabase
// Native fetch implementation (Zero npm dependencies required for Cloudflare Pages Functions)
// Integrated High-Security Authentication Gate (Restricted to Authorized Admin)

const DEFAULT_SUPABASE_URL = 'https://eqahxzlmgcjosdwgmwzf.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxYWh4emxtZ2Nqb3Nkd2dtd3pmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzI0ODEwMiwiZXhwIjoyMTA4ODI0MTAyfQ.buzRmM6DOGN0y6_D4sYKc5a7J2shBFI9WZq89Ck3vt8';

const ADMIN_EMAIL = 'itsinjamul@gmail.com';
const ADMIN_PASSWORD = 'Writerify@50463#';
const AUTH_SECRET = 'KYROS_SECURE_AUTH_KEY_2026_WRITERIFY_50463';

async function createToken(email) {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days session
  const data = email + ':' + exp;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const sigHex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const full = data + ':' + sigHex;
  return btoa(full).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function verifyToken(token) {
  if (!token) return null;
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const raw = atob(b64);
    const parts = raw.split(':');
    if (parts.length !== 3) return null;
    const [email, expStr, sigHex] = parts;
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return null;
    if (Number(expStr) < Date.now()) return null;

    const data = email + ':' + expStr;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(AUTH_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    const expectedHex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    return sigHex === expectedHex ? { email } : null;
  } catch (e) {
    return null;
  }
}

function getSupabaseConfig(env) {
  const url = (env && env.SUPABASE_URL) || DEFAULT_SUPABASE_URL;
  const key = (env && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY || env.SUPABASE_ANON_KEY)) || DEFAULT_SUPABASE_KEY;
  return {
    url: url.replace(/\/$/, ''),
    key
  };
}

async function sbFetch(env, endpoint, options = {}) {
  const { url, key } = getSupabaseConfig(env);
  const targetUrl = `${url}/rest/v1${endpoint}`;
  
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(targetUrl, {
    ...options,
    headers
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Supabase REST error (${response.status}): ${errorText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  return null;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders()
  });
}

function textResponse(text, status = 200, contentType = 'text/plain', filename = '') {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': contentType
  };
  if (filename) {
    headers['Content-Disposition'] = `attachment; filename="${filename}"`;
  }
  return new Response(text, { status, headers });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  try {
    // 1. PUBLIC AUTH ROUTE: POST /api/auth/login
    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      if (email === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
        const token = await createToken(ADMIN_EMAIL);
        return jsonResponse({
          success: true,
          token,
          user: {
            email: ADMIN_EMAIL,
            name: 'Injamul Haque',
            role: 'admin'
          }
        });
      }

      return jsonResponse({ success: false, error: 'Invalid email or password' }, 401);
    }

    // 2. EXTRACT AUTH TOKEN
    let token = null;
    const authHeader = request.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (url.searchParams.has('token')) {
      token = url.searchParams.get('token');
    }

    // 3. PUBLIC AUTH VERIFY ROUTE: GET /api/auth/verify
    if (pathname === '/api/auth/verify' && method === 'GET') {
      const authUser = await verifyToken(token);
      if (authUser) {
        return jsonResponse({
          success: true,
          user: {
            email: authUser.email,
            name: 'Injamul Haque',
            role: 'admin'
          }
        });
      }
      return jsonResponse({ success: false, error: 'Session expired or invalid token' }, 401);
    }

    // 4. STRICT SECURITY GATE: Protect ALL other /api/* endpoints
    const authenticated = await verifyToken(token);
    if (!authenticated) {
      return jsonResponse({
        success: false,
        error: 'Unauthorized access. Please log in with authorized credentials.'
      }, 401);
    }

    // ==========================================
    // PROTECTED ENDPOINTS (Authorized Admin Only)
    // ==========================================

    // GET /api/targets
    if (pathname === '/api/targets' && method === 'GET') {
      const data = await sbFetch(env, '/settings?select=*').catch(() => []);
      let goalSites = 500;
      let goalMonthlyIncome = 15000;
      if (Array.isArray(data)) {
        const sSites = data.find(s => s.key === 'goal_sites');
        const sIncome = data.find(s => s.key === 'goal_monthly_income');
        if (sSites) goalSites = parseInt(sSites.value, 10);
        if (sIncome) goalMonthlyIncome = parseFloat(sIncome.value);
      }
      return jsonResponse({ success: true, goalSites, goalMonthlyIncome });
    }

    // POST /api/targets
    if (pathname === '/api/targets' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (body.goalSites !== undefined) {
        await sbFetch(env, '/settings?on_conflict=key', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({ key: 'goal_sites', value: String(body.goalSites) })
        });
      }
      if (body.goalMonthlyIncome !== undefined) {
        await sbFetch(env, '/settings?on_conflict=key', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates' },
          body: JSON.stringify({ key: 'goal_monthly_income', value: String(body.goalMonthlyIncome) })
        });
      }
      return jsonResponse({ success: true, message: 'Mission targets updated' });
    }

    // GET /api/mission/summary
    if (pathname === '/api/mission/summary' && method === 'GET') {
      const now = new Date();
      const currentMonthKey = url.searchParams.get('month') || now.toISOString().slice(0, 7);
      const [curYear, curMonth] = currentMonthKey.split('-').map(Number);

      const lastMonthDate = new Date(Date.UTC(curYear, curMonth - 2, 1));
      const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);
      const thisYearPrefix = `${curYear}-`;
      const lastYearPrefix = `${curYear - 1}-`;

      const [sites, metrics, expenses, settings] = await Promise.all([
        sbFetch(env, '/sites?select=id,site_url,site_name,username,status').catch(() => []),
        sbFetch(env, '/monthly_site_metrics?select=*').catch(() => []),
        sbFetch(env, '/expenses_ledger?select=*').catch(() => []),
        sbFetch(env, '/settings?select=*').catch(() => [])
      ]);

      const allSites = sites || [];
      const allMetrics = metrics || [];
      const allExpenses = expenses || [];
      const allSettings = settings || [];

      function getMetricsForMonth(monthKey) {
        const monthMetrics = allMetrics.filter(m => m.month_key === monthKey);
        const monthExpenses = allExpenses.filter(e => e.month_key === monthKey);

        const ads = monthMetrics.reduce((sum, m) => sum + (parseFloat(m.ads_income) || 0), 0);
        const amazon = monthMetrics.reduce((sum, m) => sum + (parseFloat(m.amazon_income) || 0), 0);
        const other = monthMetrics.reduce((sum, m) => sum + (parseFloat(m.other_income) || 0), 0);
        const siteCost = monthMetrics.reduce((sum, m) => sum + (parseFloat(m.cost) || 0), 0);
        const articles = monthMetrics.reduce((sum, m) => sum + (parseInt(m.articles_count, 10) || 0), 0);
        const ledgerCost = monthExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        const income = ads + amazon + other;
        const cost = siteCost + ledgerCost;
        return { income, cost, profit: income - cost, ads, amazon, other, articles };
      }

      function getMetricsForYear(yearPrefix) {
        const yearMetrics = allMetrics.filter(m => m.month_key && m.month_key.startsWith(yearPrefix));
        const yearExpenses = allExpenses.filter(e => e.month_key && e.month_key.startsWith(yearPrefix));

        const ads = yearMetrics.reduce((sum, m) => sum + (parseFloat(m.ads_income) || 0), 0);
        const amazon = yearMetrics.reduce((sum, m) => sum + (parseFloat(m.amazon_income) || 0), 0);
        const other = yearMetrics.reduce((sum, m) => sum + (parseFloat(m.other_income) || 0), 0);
        const siteCost = yearMetrics.reduce((sum, m) => sum + (parseFloat(m.cost) || 0), 0);
        const ledgerCost = yearExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        const income = ads + amazon + other;
        const cost = siteCost + ledgerCost;
        return { income, cost, profit: income - cost };
      }

      function getLifetimeMetrics() {
        const ads = allMetrics.reduce((sum, m) => sum + (parseFloat(m.ads_income) || 0), 0);
        const amazon = allMetrics.reduce((sum, m) => sum + (parseFloat(m.amazon_income) || 0), 0);
        const other = allMetrics.reduce((sum, m) => sum + (parseFloat(m.other_income) || 0), 0);
        const siteCost = allMetrics.reduce((sum, m) => sum + (parseFloat(m.cost) || 0), 0);
        const ledgerCost = allExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        const income = ads + amazon + other;
        const cost = siteCost + ledgerCost;
        return { income, cost, profit: income - cost };
      }

      const thisMonth = getMetricsForMonth(currentMonthKey);
      const lastMonth = getMetricsForMonth(lastMonthKey);
      const thisYear = getMetricsForYear(thisYearPrefix);
      const lastYear = getMetricsForYear(lastYearPrefix);
      const lifetime = getLifetimeMetrics();

      const statusCounts = { running: 0, penalty: 0, deleted: 0, sold: 0 };
      allSites.forEach(s => {
        if (statusCounts[s.status] !== undefined) statusCounts[s.status]++;
      });

      const trend12Months = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(curYear, curMonth - 1 - i, 1));
        const mKey = d.toISOString().slice(0, 7);
        const mLabel = `${monthNames[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
        const mMetrics = getMetricsForMonth(mKey);
        trend12Months.push({
          month_key: mKey,
          label: mLabel,
          income: mMetrics.income,
          cost: mMetrics.cost,
          profit: mMetrics.profit,
          ads: mMetrics.ads,
          amazon: mMetrics.amazon
        });
      }

      // Top Sites
      const topSites = allSites.map(s => {
        const m = allMetrics.find(metric => String(metric.site_id) === String(s.id) && metric.month_key === currentMonthKey) || {};
        const ads = parseFloat(m.ads_income) || 0;
        const amazon = parseFloat(m.amazon_income) || 0;
        const other = parseFloat(m.other_income) || 0;
        const cost = parseFloat(m.cost) || 0;
        const total = ads + amazon + other;
        return {
          id: s.id,
          site_url: s.site_url,
          site_name: s.site_name,
          username: s.username,
          status: s.status,
          ads,
          amazon,
          other,
          total_income: total,
          cost,
          profit: total - cost
        };
      }).sort((a, b) => b.total_income - a.total_income).slice(0, 5);

      const daysInMonth = new Date(curYear, curMonth, 0).getDate();
      let daysLeft = daysInMonth;
      if (curYear === now.getFullYear() && (curMonth - 1) === now.getMonth()) {
        daysLeft = Math.max(1, daysInMonth - now.getDate());
      }

      let goalSites = 500;
      let goalMonthlyIncome = 15000;
      const sSites = allSettings.find(s => s.key === 'goal_sites');
      const sIncome = allSettings.find(s => s.key === 'goal_monthly_income');
      if (sSites) goalSites = parseInt(sSites.value, 10);
      if (sIncome) goalMonthlyIncome = parseFloat(sIncome.value);

      const remainingIncomeGoal = Math.max(0, goalMonthlyIncome - thisMonth.income);
      const dailyRunRateNeeded = daysLeft > 0 ? (remainingIncomeGoal / daysLeft) : 0;

      return jsonResponse({
        success: true,
        month: currentMonthKey,
        goalSites,
        goalMonthlyIncome,
        daysLeft,
        dailyRunRateNeeded,
        thisMonth,
        lastMonth,
        thisYear,
        lastYear,
        lifetime,
        statusCounts,
        totalSites: allSites.length,
        trend12Months,
        topSites,
        incomeMix: {
          ads: thisMonth.ads,
          amazon: thisMonth.amazon,
          other: thisMonth.other,
          total: thisMonth.income
        }
      });
    }

    // GET /api/sites
    if (pathname === '/api/sites' && method === 'GET') {
      const monthKey = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      const status = (url.searchParams.get('status') || '').trim();

      const [sites, metrics] = await Promise.all([
        sbFetch(env, '/sites?select=*&order=id.asc').catch(() => []),
        sbFetch(env, `/monthly_site_metrics?select=*&month_key=eq.${encodeURIComponent(monthKey)}`).catch(() => [])
      ]);

      let siteList = (sites || []).map(s => {
        const m = (metrics || []).find(metric => String(metric.site_id) === String(s.id)) || {};
        const ads = parseFloat(m.ads_income) || 0;
        const amazon = parseFloat(m.amazon_income) || 0;
        const other = parseFloat(m.other_income) || 0;
        const cost = parseFloat(m.cost) || 0;
        const total = ads + amazon + other;
        return {
          id: s.id,
          site_url: s.site_url,
          site_name: s.site_name,
          username: s.username,
          status: s.status,
          articles_count: parseInt(m.articles_count, 10) || 0,
          cost,
          ads_income: ads,
          amazon_income: amazon,
          other_income: other,
          total_income: total,
          profit: total - cost,
          notes: m.notes || ''
        };
      });

      if (status && status !== 'all') {
        siteList = siteList.filter(s => s.status === status);
      }

      if (search) {
        siteList = siteList.filter(s =>
          (s.site_url && s.site_url.toLowerCase().includes(search)) ||
          (s.site_name && s.site_name.toLowerCase().includes(search)) ||
          (s.username && s.username.toLowerCase().includes(search))
        );
      }

      return jsonResponse({ success: true, month: monthKey, count: siteList.length, sites: siteList });
    }

    // POST /api/sites
    if (pathname === '/api/sites' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.site_url) return jsonResponse({ success: false, error: 'site_url is required' }, 400);

      let formattedUrl = body.site_url.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = 'https://' + formattedUrl;
      if (!formattedUrl.endsWith('/')) formattedUrl += '/';

      let siteName = body.site_name || '';
      if (!siteName) {
        try { siteName = new URL(formattedUrl).hostname.replace(/^www\./, ''); } catch { siteName = formattedUrl; }
      }

      const newSites = await sbFetch(env, '/sites', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          site_url: formattedUrl,
          site_name: siteName,
          username: body.username || '',
          status: body.status || 'running'
        })
      });

      const newSite = Array.isArray(newSites) ? newSites[0] : newSites;
      if (!newSite || !newSite.id) {
        return jsonResponse({ success: false, error: 'Failed to create site' }, 500);
      }

      const monthKey = body.month_key || new Date().toISOString().slice(0, 7);
      await sbFetch(env, '/monthly_site_metrics?on_conflict=site_id,month_key', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          site_id: newSite.id,
          month_key: monthKey,
          articles_count: body.articles_count || 0,
          cost: body.cost || 0,
          ads_income: body.ads_income || 0,
          amazon_income: body.amazon_income || 0,
          other_income: 0
        })
      });

      return jsonResponse({ success: true, siteId: newSite.id, message: 'Site added successfully' }, 201);
    }

    // PUT /api/sites/:id
    if (pathname.startsWith('/api/sites/') && method === 'PUT') {
      const id = pathname.split('/')[3];
      const body = await request.json().catch(() => ({}));

      const updates = { updated_at: new Date().toISOString() };
      if (body.site_url !== undefined) updates.site_url = body.site_url;
      if (body.site_name !== undefined) updates.site_name = body.site_name;
      if (body.username !== undefined) updates.username = body.username;
      if (body.status !== undefined) updates.status = body.status;

      await sbFetch(env, `/sites?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(updates)
      });

      return jsonResponse({ success: true, message: 'Site updated successfully' });
    }

    // DELETE /api/sites/:id
    if (pathname.startsWith('/api/sites/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      await sbFetch(env, `/sites?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      return jsonResponse({ success: true, message: 'Site deleted successfully' });
    }

    // POST /api/metrics/update
    if (pathname === '/api/metrics/update' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { site_id, month_key } = body;
      if (!site_id || !month_key) return jsonResponse({ success: false, error: 'site_id and month_key required' }, 400);

      await sbFetch(env, '/monthly_site_metrics?on_conflict=site_id,month_key', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          site_id: parseInt(site_id, 10),
          month_key,
          articles_count: body.articles_count || 0,
          cost: parseFloat(body.cost) || 0,
          ads_income: parseFloat(body.ads_income) || 0,
          amazon_income: parseFloat(body.amazon_income) || 0,
          other_income: parseFloat(body.other_income) || 0,
          notes: body.notes || '',
          updated_at: new Date().toISOString()
        })
      });

      return jsonResponse({ success: true, message: 'Metrics updated successfully' });
    }

    // GET /api/expenses
    if (pathname === '/api/expenses' && method === 'GET') {
      const monthKey = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      const range = url.searchParams.get('range') || 'thisMonth';
      const [curYear, curMonth] = monthKey.split('-').map(Number);

      const [expenses, sites] = await Promise.all([
        sbFetch(env, '/expenses_ledger?select=*&order=expense_date.desc').catch(() => []),
        sbFetch(env, '/sites?select=id,site_url,site_name').catch(() => [])
      ]);

      const allExpenses = expenses || [];
      const sitesMap = {};
      (sites || []).forEach(s => { sitesMap[s.id] = s.site_name || s.site_url; });

      let filtered = allExpenses;
      if (range === 'thisMonth') {
        filtered = allExpenses.filter(e => e.month_key === monthKey);
      } else if (range === 'lastMonth') {
        const lastMonthDate = new Date(Date.UTC(curYear, curMonth - 2, 1));
        const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);
        filtered = allExpenses.filter(e => e.month_key === lastMonthKey);
      } else if (range === 'thisYear') {
        filtered = allExpenses.filter(e => e.month_key && e.month_key.startsWith(`${curYear}-`));
      }

      const formattedExpenses = filtered.map(e => ({
        ...e,
        site_name: e.site_id ? (sitesMap[e.site_id] || `Site #${e.site_id}`) : 'Global / Operations'
      }));

      const totalAmount = formattedExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      return jsonResponse({ success: true, range, count: formattedExpenses.length, totalAmount, expenses: formattedExpenses });
    }

    // POST /api/expenses
    if (pathname === '/api/expenses' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.title || body.amount === undefined) {
        return jsonResponse({ success: false, error: 'title and amount are required' }, 400);
      }

      const expenseDate = body.expense_date || new Date().toISOString().slice(0, 10);
      const monthKey = body.month_key || expenseDate.slice(0, 7);

      const created = await sbFetch(env, '/expenses_ledger', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          expense_date: expenseDate,
          month_key: monthKey,
          site_id: body.site_id ? parseInt(body.site_id, 10) : null,
          category: body.category || 'miscellaneous',
          title: body.title.trim(),
          amount: parseFloat(body.amount) || 0,
          receipt_url: body.receipt_url || ''
        })
      });

      const item = Array.isArray(created) ? created[0] : created;
      return jsonResponse({ success: true, expenseId: item ? item.id : null, message: 'Expense added to ledger' }, 201);
    }

    // GET /api/export/csv
    if (pathname === '/api/export/csv' && method === 'GET') {
      const type = url.searchParams.get('type') || 'sites';
      if (type === 'sites') {
        const monthKey = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
        const [sites, metrics] = await Promise.all([
          sbFetch(env, '/sites?select=*&order=id.asc').catch(() => []),
          sbFetch(env, `/monthly_site_metrics?select=*&month_key=eq.${encodeURIComponent(monthKey)}`).catch(() => [])
        ]);

        let csv = 'ID,Site Name,Site URL,Author/Username,Status,Month,Articles,Cost,Ads Income,Amazon Income,Other Income,Total Income,Profit\n';
        (sites || []).forEach(s => {
          const m = (metrics || []).find(metric => String(metric.site_id) === String(s.id)) || {};
          const ads = parseFloat(m.ads_income) || 0;
          const amazon = parseFloat(m.amazon_income) || 0;
          const other = parseFloat(m.other_income) || 0;
          const cost = parseFloat(m.cost) || 0;
          const total = ads + amazon + other;
          const profit = total - cost;
          csv += `"${s.id}","${s.site_name || ''}","${s.site_url}","${s.username || ''}","${s.status}","${monthKey}",${m.articles_count || 0},${cost.toFixed(2)},${ads.toFixed(2)},${amazon.toFixed(2)},${other.toFixed(2)},${total.toFixed(2)},${profit.toFixed(2)}\n`;
        });

        return textResponse(csv, 200, 'text/csv', `kyros_sites_${monthKey}.csv`);
      }

      if (type === 'expenses') {
        const expenses = await sbFetch(env, '/expenses_ledger?select=*&order=expense_date.desc').catch(() => []);
        let csv = 'ID,Date,Month,Site ID,Category,Title,Amount,Receipt URL\n';
        (expenses || []).forEach(e => {
          csv += `"${e.id}","${e.expense_date}","${e.month_key}","${e.site_id || ''}","${e.category}","${(e.title || '').replace(/"/g, '""')}",${(parseFloat(e.amount) || 0).toFixed(2)},"${e.receipt_url || ''}"\n`;
        });
        return textResponse(csv, 200, 'text/csv', 'kyros_expenses_ledger.csv');
      }
    }

    // GET /api/backup/export
    if (pathname === '/api/backup/export' && method === 'GET') {
      const [settings, sites, metrics, expenses] = await Promise.all([
        sbFetch(env, '/settings?select=*').catch(() => []),
        sbFetch(env, '/sites?select=*').catch(() => []),
        sbFetch(env, '/monthly_site_metrics?select=*').catch(() => []),
        sbFetch(env, '/expenses_ledger?select=*').catch(() => [])
      ]);

      const backup = {
        timestamp: new Date().toISOString(),
        settings: settings || [],
        sites: sites || [],
        metrics: metrics || [],
        expenses: expenses || []
      };

      return textResponse(JSON.stringify(backup, null, 2), 200, 'application/json', `kyros_portfolio_full_backup_${Date.now()}.json`);
    }

    return jsonResponse({ success: false, error: `Endpoint ${pathname} not found` }, 404);
  } catch (err) {
    console.error('Pages Function Error:', err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
