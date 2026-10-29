import { createClient } from '@supabase/supabase-js';

function getSupabase(env) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY || env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in Cloudflare environment variables.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
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
    const supabase = getSupabase(env);

    // GET /api/targets
    if (pathname === '/api/targets' && method === 'GET') {
      const { data } = await supabase.from('settings').select('*');
      let goalSites = 500;
      let goalMonthlyIncome = 15000;
      if (data) {
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
        await supabase.from('settings').upsert({ key: 'goal_sites', value: String(body.goalSites) });
      }
      if (body.goalMonthlyIncome !== undefined) {
        await supabase.from('settings').upsert({ key: 'goal_monthly_income', value: String(body.goalMonthlyIncome) });
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

      return jsonResponse({ success: true, month: monthKey, count: sites.length, sites });
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

      const { data: newSite, error } = await supabase.from('sites').insert({
        site_url: formattedUrl,
        site_name: siteName,
        username: body.username || '',
        status: body.status || 'running'
      }).select('id').single();

      if (error) {
        return jsonResponse({ success: false, error: error.message }, 400);
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

      const { error } = await supabase.from('sites').update(updates).eq('id', id);
      if (error) return jsonResponse({ success: false, error: error.message }, 400);
      return jsonResponse({ success: true, message: 'Site updated successfully' });
    }

    // DELETE /api/sites/:id
    if (pathname.startsWith('/api/sites/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      const { error } = await supabase.from('sites').delete().eq('id', id);
      if (error) return jsonResponse({ success: false, error: error.message }, 400);
      return jsonResponse({ success: true, message: 'Site deleted successfully' });
    }

    // POST /api/metrics/update
    if (pathname === '/api/metrics/update' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const { site_id, month_key } = body;
      if (!site_id || !month_key) return jsonResponse({ success: false, error: 'site_id and month_key required' }, 400);

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

      if (error) return jsonResponse({ success: false, error: error.message }, 400);
      return jsonResponse({ success: true, message: 'Metrics updated successfully' });
    }

    // GET /api/expenses
    if (pathname === '/api/expenses' && method === 'GET') {
      const monthKey = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      const range = url.searchParams.get('range') || 'thisMonth';
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
      return jsonResponse({ success: true, range, count: expenses.length, totalAmount, expenses });
    }

    // POST /api/expenses
    if (pathname === '/api/expenses' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body.title || body.amount === undefined) {
        return jsonResponse({ success: false, error: 'title and amount are required' }, 400);
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

      if (error) return jsonResponse({ success: false, error: error.message }, 400);
      return jsonResponse({ success: true, expenseId: data.id, message: 'Expense added to ledger' }, 201);
    }

    // GET /api/export/csv
    if (pathname === '/api/export/csv' && method === 'GET') {
      const type = url.searchParams.get('type') || 'sites';
      if (type === 'sites') {
        const monthKey = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
        const [sitesRes, metricsRes] = await Promise.all([
          supabase.from('sites').select('*').order('id', { ascending: true }),
          supabase.from('monthly_site_metrics').select('*').eq('month_key', monthKey)
        ]);

        let csv = 'ID,Site Name,Site URL,Author/Username,Status,Month,Articles,Cost,Ads Income,Amazon Income,Other Income,Total Income,Profit\n';
        (sitesRes.data || []).forEach(s => {
          const m = (metricsRes.data || []).find(metric => String(metric.site_id) === String(s.id)) || {};
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
        const { data: expenses } = await supabase.from('expenses_ledger').select('*').order('expense_date', { ascending: false });
        let csv = 'ID,Date,Month,Site ID,Category,Title,Amount,Receipt URL\n';
        (expenses || []).forEach(e => {
          csv += `"${e.id}","${e.expense_date}","${e.month_key}","${e.site_id || ''}","${e.category}","${(e.title || '').replace(/"/g, '""')}",${(parseFloat(e.amount) || 0).toFixed(2)},"${e.receipt_url || ''}"\n`;
        });
        return textResponse(csv, 200, 'text/csv', 'kyros_expenses_ledger.csv');
      }
    }

    // GET /api/backup/export
    if (pathname === '/api/backup/export' && method === 'GET') {
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

      return textResponse(JSON.stringify(backup, null, 2), 200, 'application/json', `kyros_portfolio_full_backup_${Date.now()}.json`);
    }

    return jsonResponse({ success: false, error: `Endpoint ${pathname} not found` }, 404);
  } catch (err) {
    console.error('Pages Function Error:', err);
    return jsonResponse({ success: false, error: err.message }, 500);
  }
}
