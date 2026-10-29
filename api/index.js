import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY environment variables.');
  }
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
  });
}

function sendJson(res, statusCode, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.statusCode = statusCode;
  return res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text, contentType = 'text/plain') {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (typeof res.status === 'function' && typeof res.send === 'function') {
    return res.status(statusCode).send(text);
  }
  res.statusCode = statusCode;
  return res.end(text);
}

async function getRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (typeof res.status === 'function') return res.status(204).end();
    res.statusCode = 204;
    return res.end();
  }

  const urlObj = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  try {
    const supabase = getSupabase();

    // GET /api/targets
    if (pathname === '/api/targets' && req.method === 'GET') {
      const { data } = await supabase.from('settings').select('*');
      let goalSites = 500;
      let goalMonthlyIncome = 15000;
      if (data) {
        const sSites = data.find(s => s.key === 'goal_sites');
        const sIncome = data.find(s => s.key === 'goal_monthly_income');
        if (sSites) goalSites = parseInt(sSites.value, 10);
        if (sIncome) goalMonthlyIncome = parseFloat(sIncome.value);
      }
      return sendJson(res, 200, { success: true, goalSites, goalMonthlyIncome });
    }

    // POST /api/targets
    if (pathname === '/api/targets' && req.method === 'POST') {
      const body = await getRequestBody(req);
      if (body.goalSites !== undefined) {
        await supabase.from('settings').upsert({ key: 'goal_sites', value: String(body.goalSites) });
      }
      if (body.goalMonthlyIncome !== undefined) {
        await supabase.from('settings').upsert({ key: 'goal_monthly_income', value: String(body.goalMonthlyIncome) });
      }
      return sendJson(res, 200, { success: true, message: 'Mission targets updated' });
    }

    // GET /api/mission/summary
    if (pathname === '/api/mission/summary' && req.method === 'GET') {
      const now = new Date();
      const currentMonthKey = urlObj.searchParams.get('month') || now.toISOString().slice(0, 7);
      const [curYear, curMonth] = currentMonthKey.split('-').map(Number);

      const lastMonthDate = new Date(Date.UTC(curYear, curMonth - 2, 1));
      const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);
      const thisYearPrefix = `${curYear}-`;
      const lastYearPrefix = `${curYear - 1}-`;

      const [sitesRes, metricsRes, expensesRes, settingsRes] = await Promise.all([
        supabase.from('sites').select('id, site_url, site_name, username, status'),
        supabase.from('monthly_site_metrics').select('*'),
        supabase.from('expenses_ledger').select('*'),
        supabase.from('settings').select('*')
      ]);

      const allSites = sitesRes.data || [];
      const allMetrics = metricsRes.data || [];
      const allExpenses = expensesRes.data || [];
      const allSettings = settingsRes.data || [];

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

      return sendJson(res, 200, {
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
    if (pathname === '/api/sites' && req.method === 'GET') {
      const monthKey = urlObj.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      const search = (urlObj.searchParams.get('search') || '').trim().toLowerCase();
      const status = (urlObj.searchParams.get('status') || '').trim();

      const [sitesRes, metricsRes] = await Promise.all([
        supabase.from('sites').select('*').order('id', { ascending: true }),
        supabase.from('monthly_site_metrics').select('*').eq('month_key', monthKey)
      ]);

      let sites = (sitesRes.data || []).map(s => {
        const m = (metricsRes.data || []).find(metric => String(metric.site_id) === String(s.id)) || {};
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
          domain_registrar: s.domain_registrar || '',
          hosting_provider: s.hosting_provider || '',
          domain_expiry: s.domain_expiry || '',
          amazon_account: s.amazon_account || '',
          amazon_tracking_id: s.amazon_tracking_id || '',
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
        sites = sites.filter(s => s.status === status);
      }

      if (search) {
        sites = sites.filter(s =>
          (s.site_url && s.site_url.toLowerCase().includes(search)) ||
          (s.site_name && s.site_name.toLowerCase().includes(search)) ||
          (s.username && s.username.toLowerCase().includes(search))
        );
      }

      return sendJson(res, 200, { success: true, month: monthKey, count: sites.length, sites });
    }

    // POST /api/sites
    if (pathname === '/api/sites' && req.method === 'POST') {
      const body = await getRequestBody(req);
      if (!body.site_url) return sendJson(res, 400, { success: false, error: 'site_url is required' });

      let formattedUrl = body.site_url.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) formattedUrl = 'https://' + formattedUrl;
      if (!formattedUrl.endsWith('/')) formattedUrl += '/';

      let siteName = body.site_name || '';
      if (!siteName) {
        try { siteName = new URL(formattedUrl).hostname.replace(/^www\./, ''); } catch { siteName = formattedUrl; }
      }

      const { data: newSite, error } = await supabase.from('sites').insert({
        site_url: formattedUrl,
        site_name: siteName,
        username: body.username || '',
        status: body.status || 'running',
        domain_registrar: body.domain_registrar || '',
        hosting_provider: body.hosting_provider || '',
        domain_expiry: body.domain_expiry || '',
        amazon_account: body.amazon_account || '',
        amazon_tracking_id: body.amazon_tracking_id || ''
      }).select('id').single();

      if (error) {
        if (error.code === '23505' || (error.message && error.message.includes('unique constraint'))) {
          return sendJson(res, 409, { success: false, error: 'This website URL is already added to your portfolio! (Duplicate URL)' });
        }
        return sendJson(res, 400, { success: false, error: error.message });
      }

      const monthKey = body.month_key || new Date().toISOString().slice(0, 7);
      await supabase.from('monthly_site_metrics').insert({
        site_id: newSite.id,
        month_key: monthKey,
        articles_count: body.articles_count || 0,
        cost: body.cost || 0,
        ads_income: body.ads_income || 0,
        amazon_income: body.amazon_income || 0,
        other_income: 0
      });

      return sendJson(res, 201, { success: true, siteId: newSite.id, message: 'Site added successfully' });
    }

    // PUT /api/sites/:id
    if (pathname.startsWith('/api/sites/') && req.method === 'PUT') {
      const id = pathname.split('/')[3];
      const body = await getRequestBody(req);

      const updates = { updated_at: new Date().toISOString() };
      if (body.site_url !== undefined) updates.site_url = body.site_url;
      if (body.site_name !== undefined) updates.site_name = body.site_name;
      if (body.username !== undefined) updates.username = body.username;
      if (body.status !== undefined) updates.status = body.status;
      if (body.domain_registrar !== undefined) updates.domain_registrar = body.domain_registrar;
      if (body.hosting_provider !== undefined) updates.hosting_provider = body.hosting_provider;
      if (body.domain_expiry !== undefined) updates.domain_expiry = body.domain_expiry;
      if (body.amazon_account !== undefined) updates.amazon_account = body.amazon_account;
      if (body.amazon_tracking_id !== undefined) updates.amazon_tracking_id = body.amazon_tracking_id;

      const { error } = await supabase.from('sites').update(updates).eq('id', id);
      if (error) return sendJson(res, 400, { success: false, error: error.message });
      return sendJson(res, 200, { success: true, message: 'Site updated successfully' });
    }

    // DELETE /api/sites/:id
    if (pathname.startsWith('/api/sites/') && req.method === 'DELETE') {
      const id = pathname.split('/')[3];
      const { error } = await supabase.from('sites').delete().eq('id', id);
      if (error) return sendJson(res, 400, { success: false, error: error.message });
      return sendJson(res, 200, { success: true, message: 'Site deleted successfully' });
    }

    // POST /api/metrics/update
    if (pathname === '/api/metrics/update' && req.method === 'POST') {
      const body = await getRequestBody(req);
      const { site_id, month_key } = body;
      if (!site_id || !month_key) return sendJson(res, 400, { success: false, error: 'site_id and month_key required' });

      const { error } = await supabase.from('monthly_site_metrics').upsert({
        site_id: parseInt(site_id, 10),
        month_key,
        articles_count: body.articles_count || 0,
        cost: parseFloat(body.cost) || 0,
        ads_income: parseFloat(body.ads_income) || 0,
        amazon_income: parseFloat(body.amazon_income) || 0,
        other_income: parseFloat(body.other_income) || 0,
        notes: body.notes || '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'site_id,month_key' });

      if (error) return sendJson(res, 400, { success: false, error: error.message });
      return sendJson(res, 200, { success: true, message: 'Metrics updated successfully' });
    }

    // GET /api/expenses
    if (pathname === '/api/expenses' && req.method === 'GET') {
      const monthKey = urlObj.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      const range = urlObj.searchParams.get('range') || 'thisMonth';
      const [curYear, curMonth] = monthKey.split('-').map(Number);

      const [expensesRes, sitesRes] = await Promise.all([
        supabase.from('expenses_ledger').select('*').order('expense_date', { ascending: false }),
        supabase.from('sites').select('id, site_url, site_name')
      ]);

      const allExpenses = expensesRes.data || [];
      const sitesMap = {};
      (sitesRes.data || []).forEach(s => { sitesMap[s.id] = s.site_name || s.site_url; });

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

      const expenses = filtered.map(e => ({
        ...e,
        site_name: e.site_id ? (sitesMap[e.site_id] || `Site #${e.site_id}`) : 'Global / Operations'
      }));

      const totalAmount = expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      return sendJson(res, 200, { success: true, range, count: expenses.length, totalAmount, expenses });
    }

    // POST /api/expenses
    if (pathname === '/api/expenses' && req.method === 'POST') {
      const body = await getRequestBody(req);
      if (!body.title || body.amount === undefined) {
        return sendJson(res, 400, { success: false, error: 'title and amount are required' });
      }

      const expenseDate = body.expense_date || new Date().toISOString().slice(0, 10);
      const monthKey = body.month_key || expenseDate.slice(0, 7);

      const { data, error } = await supabase.from('expenses_ledger').insert({
        expense_date: expenseDate,
        month_key: monthKey,
        site_id: body.site_id ? parseInt(body.site_id, 10) : null,
        category: body.category || 'miscellaneous',
        title: body.title.trim(),
        amount: parseFloat(body.amount) || 0,
        receipt_url: body.receipt_url || ''
      }).select('id').single();

      if (error) return sendJson(res, 400, { success: false, error: error.message });
      return sendJson(res, 201, { success: true, expenseId: data.id, message: 'Expense added to ledger' });
    }

    // GET /api/export/csv
    if (pathname === '/api/export/csv' && req.method === 'GET') {
      const type = urlObj.searchParams.get('type') || 'sites';
      if (type === 'sites') {
        const monthKey = urlObj.searchParams.get('month') || new Date().toISOString().slice(0, 7);
        const [sitesRes, metricsRes] = await Promise.all([
          supabase.from('sites').select('*').order('id', { ascending: true }),
          supabase.from('monthly_site_metrics').select('*').eq('month_key', monthKey)
        ]);

        let csv = 'ID,Site Name,Site URL,Author/Username,Status,Domain Registrar,Hosting Provider,Domain Expiry,Amazon Account,Amazon Tracking ID,Month,Articles,Cost,Ads Income,Amazon Income,Other Income,Total Income,Profit\n';
        (sitesRes.data || []).forEach(s => {
          const m = (metricsRes.data || []).find(metric => String(metric.site_id) === String(s.id)) || {};
          const ads = parseFloat(m.ads_income) || 0;
          const amazon = parseFloat(m.amazon_income) || 0;
          const other = parseFloat(m.other_income) || 0;
          const cost = parseFloat(m.cost) || 0;
          const total = ads + amazon + other;
          const profit = total - cost;
          csv += `"${s.id}","${s.site_name || ''}","${s.site_url}","${s.username || ''}","${s.status}","${s.domain_registrar || ''}","${s.hosting_provider || ''}","${s.domain_expiry || ''}","${s.amazon_account || ''}","${s.amazon_tracking_id || ''}","${monthKey}",${m.articles_count || 0},${cost.toFixed(2)},${ads.toFixed(2)},${amazon.toFixed(2)},${other.toFixed(2)},${total.toFixed(2)},${profit.toFixed(2)}\n`;
        });

        res.setHeader('Content-Disposition', `attachment; filename="writerify_sites_${monthKey}.csv"`);
        return sendText(res, 200, csv, 'text/csv');
      }

      if (type === 'expenses') {
        const { data: expenses } = await supabase.from('expenses_ledger').select('*').order('expense_date', { ascending: false });
        let csv = 'ID,Date,Month,Site ID,Category,Title,Amount,Receipt URL\n';
        (expenses || []).forEach(e => {
          csv += `"${e.id}","${e.expense_date}","${e.month_key}","${e.site_id || ''}","${e.category}","${(e.title || '').replace(/"/g, '""')}",${(parseFloat(e.amount) || 0).toFixed(2)},"${e.receipt_url || ''}"\n`;
        });
        res.setHeader('Content-Disposition', 'attachment; filename="writerify_expenses_ledger.csv"');
        return sendText(res, 200, csv, 'text/csv');
      }
    }

    // GET /api/backup/export
    if (pathname === '/api/backup/export' && req.method === 'GET') {
      const [settingsRes, sitesRes, metricsRes, expensesRes] = await Promise.all([
        supabase.from('settings').select('*'),
        supabase.from('sites').select('*'),
        supabase.from('monthly_site_metrics').select('*'),
        supabase.from('expenses_ledger').select('*')
      ]);

      const backup = {
        timestamp: new Date().toISOString(),
        settings: settingsRes.data || [],
        sites: sitesRes.data || [],
        metrics: metricsRes.data || [],
        expenses: expensesRes.data || []
      };

      res.setHeader('Content-Disposition', `attachment; filename="writerify_portfolio_full_backup_${Date.now()}.json"`);
      return sendJson(res, 200, backup);
    }

    return sendJson(res, 404, { success: false, error: `Endpoint ${pathname} not found` });
  } catch (err) {
    console.error('API Error:', err);
    return sendJson(res, 500, { success: false, error: err.message });
  }
}
