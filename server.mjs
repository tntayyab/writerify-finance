import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const ADMIN_EMAIL = 'itsinjamul@gmail.com';
const ADMIN_PASSWORD = 'Writerify@50463#';
const AUTH_SECRET = 'WRITERIFY_SECURE_AUTH_KEY_2026_50463';

function createToken(email) {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const data = email + ':' + exp;
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('hex');
  return Buffer.from(data + ':' + sig).toString('base64url');
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const [email, expStr, sig] = raw.split(':');
    if (!email || !expStr || !sig) return null;
    if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return null;
    if (Number(expStr) < Date.now()) return null;
    const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(email + ':' + expStr).digest('hex');
    return sig === expectedSig ? { email } : null;
  } catch {
    return null;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5050;
const DB_PATH = path.join(__dirname, 'data', 'writerify_portfolio.db');
// Auto-migrate from legacy db file if it exists
if (!fs.existsSync(DB_PATH) && fs.existsSync(path.join(__dirname, 'data', 'kyros_portfolio.db'))) {
  try {
    fs.copyFileSync(path.join(__dirname, 'data', 'kyros_portfolio.db'), DB_PATH);
  } catch (e) {
    console.error('Failed to copy legacy db:', e);
  }
}
const BACKUPS_DIR = path.join(__dirname, 'data', 'backups');

if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

// Initialize SQLite database
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_url TEXT UNIQUE NOT NULL,
    site_name TEXT,
    username TEXT DEFAULT '',
    status TEXT DEFAULT 'running', -- 'running', 'penalty', 'deleted', 'sold'
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS monthly_site_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    month_key TEXT NOT NULL, -- e.g. '2026-10'
    articles_count INTEGER DEFAULT 0,
    cost REAL DEFAULT 0.0,
    ads_income REAL DEFAULT 0.0,
    amazon_income REAL DEFAULT 0.0,
    other_income REAL DEFAULT 0.0,
    notes TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(site_id, month_key)
  );

  CREATE TABLE IF NOT EXISTS expenses_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_date TEXT NOT NULL, -- e.g. '2026-10-29'
    month_key TEXT NOT NULL,    -- e.g. '2026-10'
    site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL,
    category TEXT NOT NULL,     -- 'hosting', 'domain', 'content', 'tools_ai', 'plugins', 'va_team', 'marketing', 'miscellaneous'
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    receipt_url TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default settings if missing
function getSetting(key, defaultValue = '') {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

if (!getSetting('goal_sites')) setSetting('goal_sites', '500');
if (!getSetting('goal_monthly_income')) setSetting('goal_monthly_income', '15000');

// Initial seed of Boss's sites if table is empty
const siteCount = db.prepare('SELECT COUNT(*) as count FROM sites').get().count;
if (siteCount === 0) {
  const initialSites = [
    { url: 'https://techmoviez.com/', username: 'Ethan', status: 'running' },
    { url: 'https://solarpanelgreen.com/', username: 'David', status: 'running' },
    { url: 'https://glasshouseomg.com/', username: 'Editorial', status: 'running' },
    { url: 'https://gardenders.com/', username: 'Alex', status: 'running' },
    { url: 'https://artistheopenloft.com/', username: 'James', status: 'running' },
    { url: 'https://thekitchennook.com/', username: 'Sam', status: 'running' },
    { url: 'https://craftygardenfused.com/', username: 'Arlo', status: 'running' },
    { url: 'https://themotorcover.com/', username: 'Alex', status: 'running' },
    { url: 'https://techklive.com/', username: 'Chris', status: 'running' },
    { url: 'https://fitgearshops.com/', username: 'Lucas', status: 'running' },
    { url: 'https://outdoorgasgrills.org/', username: 'Marcus', status: 'running' },
    { url: 'https://splatterballgun.info/', username: 'Hunter', status: 'running' },
    { url: 'https://vacuumcleanery.com/', username: 'Elena', status: 'running' },
    { url: 'https://carspeednest.com/', username: 'Gearhead', status: 'running' },
    { url: 'https://pcsaas.com/', username: 'TechPro', status: 'running' },
    { url: 'https://autoverseauthority.com/', username: 'TN Tayyab', status: 'running' },
    { url: 'https://getfitwithandrei.com/', username: 'Andrei', status: 'running' },
    { url: 'https://juliafashionista.com/', username: 'Julia', status: 'running' },
    { url: 'https://drivegearhub.com/', username: 'DriveMaster', status: 'running' },
    { url: 'https://lawnrecover.com/', username: 'Alex Green', status: 'running' },
    { url: 'https://diyinteriordecorating.com/', username: 'Artistic Decor', status: 'running' },
    { url: 'https://carglassfix.com/', username: 'Mustaqeem', status: 'running' },
    { url: 'https://toypcompanyhub.com/', username: 'Oliver', status: 'running' },
    { url: 'https://allabouthipmunkrooms.com/', username: 'Cozy Living', status: 'running' },
    { url: 'https://fitnessdelts.com/', username: 'Max Power', status: 'running' },
    { url: 'https://burstindhavan.com/', username: 'Traveler', status: 'running' },
    { url: 'https://mushr00mwhisperay.com/', username: 'NatureBio', status: 'running' },
    { url: 'https://campseednest.com/', username: 'Camper Dan', status: 'running' },
    { url: 'https://easydaylego.com/', username: 'BrickMaster', status: 'running' },
    { url: 'https://colfcomfortsnap.com/', username: 'GolfGuru', status: 'running' },
    { url: 'https://simplyklassichome.com/', username: 'HomeStyle', status: 'running' },
    { url: 'https://lovinglifeoutdoors.com/', username: 'Trekker', status: 'running' },
    { url: 'https://thetoolwave.com/', username: 'Craftsman', status: 'running' },
    { url: 'https://smarthomevibe.com/', username: 'IoT Specialist', status: 'running' },
    { url: 'https://audiophilezone.net/', username: 'SoundCraft', status: 'running' },
    { url: 'https://aquariumguidepro.com/', username: 'AquaNerd', status: 'running' },
    { url: 'https://espressobeanshq.com/', username: 'Barista Joe', status: 'running' },
    { url: 'https://cleantechpulse.org/', username: 'EcoPulse', status: 'running' },
    { url: 'https://droneflightzone.com/', username: 'AeroPilot', status: 'running' }
  ];

  const insertSite = db.prepare(`
    INSERT INTO sites (site_url, site_name, username, status)
    VALUES (?, ?, ?, ?)
  `);

  const currentMonth = new Date().toISOString().slice(0, 7); // e.g. '2026-10'
  const insertMetric = db.prepare(`
    INSERT INTO monthly_site_metrics (site_id, month_key, articles_count, cost, ads_income, amazon_income, other_income)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of initialSites) {
    try {
      const siteName = new URL(s.url).hostname.replace(/^www\./, '');
      const res = insertSite.run(s.url, siteName, s.username, s.status);
      const siteId = res.lastInsertRowid;
      insertMetric.run(siteId, currentMonth, 0, 0, 0, 0, 0);
    } catch (e) {
      // Ignore duplicates
    }
  }
}

// Helpers
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function sendText(res, statusCode, text, contentType = 'text/plain') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  });
  res.end(text);
}

// Backup helper
function autoBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sites = db.prepare('SELECT * FROM sites').all();
    const metrics = db.prepare('SELECT * FROM monthly_site_metrics').all();
    const expenses = db.prepare('SELECT * FROM expenses_ledger').all();
    const settings = db.prepare('SELECT * FROM settings').all();

    const snapshot = {
      timestamp: new Date().toISOString(),
      settings,
      sites,
      metrics,
      expenses
    };

    const backupFile = path.join(BACKUPS_DIR, `snapshot_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2), 'utf8');

    // Keep only the last 15 backups
    const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('snapshot_') && f.endsWith('.json')).sort();
    while (files.length > 15) {
      const oldest = files.shift();
      try { fs.unlinkSync(path.join(BACKUPS_DIR, oldest)); } catch {}
    }
  } catch (err) {
    console.error('Auto backup error:', err.message);
  }
}

// Server logic
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  try {
    // 1. PUBLIC AUTH ROUTE: POST /api/auth/login
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const email = (body.email || '').trim().toLowerCase();
      const password = body.password || '';

      if (email === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
        const token = createToken(ADMIN_EMAIL);
        return sendJson(res, 200, {
          success: true,
          token,
          user: {
            email: ADMIN_EMAIL,
            name: 'Injamul Haque',
            role: 'admin'
          }
        });
      }

      return sendJson(res, 401, { success: false, error: 'Invalid email or password' });
    }

    // 2. TOKEN EXTRACTION
    let token = null;
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (parsedUrl.searchParams.has('token')) {
      token = parsedUrl.searchParams.get('token');
    }

    // 3. PUBLIC AUTH VERIFY ROUTE: GET /api/auth/verify
    if (pathname === '/api/auth/verify' && req.method === 'GET') {
      const authUser = verifyToken(token);
      if (authUser) {
        return sendJson(res, 200, {
          success: true,
          user: {
            email: authUser.email,
            name: 'Injamul Haque',
            role: 'admin'
          }
        });
      }
      return sendJson(res, 401, { success: false, error: 'Session expired or invalid token' });
    }

    // 4. STRICT SECURITY GATE: Protect ALL other /api/* endpoints
    if (pathname.startsWith('/api/')) {
      const authenticated = verifyToken(token);
      if (!authenticated) {
        return sendJson(res, 401, {
          success: false,
          error: 'Unauthorized access. Please log in with authorized credentials.'
        });
      }
    }
    // API: TARGETS (GET / POST)
    if (pathname === '/api/targets' && req.method === 'GET') {
      const goalSites = parseInt(getSetting('goal_sites', '500'), 10);
      const goalMonthlyIncome = parseFloat(getSetting('goal_monthly_income', '15000'));
      return sendJson(res, 200, { success: true, goalSites, goalMonthlyIncome });
    }

    if (pathname === '/api/targets' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (body.goalSites !== undefined) setSetting('goal_sites', body.goalSites);
      if (body.goalMonthlyIncome !== undefined) setSetting('goal_monthly_income', body.goalMonthlyIncome);
      autoBackup();
      return sendJson(res, 200, { success: true, message: 'Mission targets updated successfully' });
    }

    // API: MISSION SUMMARY (KPIs, Charts, Status counts)
    if (pathname === '/api/mission/summary' && req.method === 'GET') {
      const now = new Date();
      const currentMonthKey = parsedUrl.searchParams.get('month') || now.toISOString().slice(0, 7);
      const [curYear, curMonth] = currentMonthKey.split('-').map(Number);

      // Last Month Key calculation
      const lastMonthDate = new Date(Date.UTC(curYear, curMonth - 2, 1));
      const lastMonthKey = lastMonthDate.toISOString().slice(0, 7);

      // Current Year & Last Year prefixes
      const thisYearPrefix = `${curYear}-`;
      const lastYearPrefix = `${curYear - 1}-`;

      // Helper for month metrics aggregate
      function getMetricsForMonth(monthKey) {
        const row = db.prepare(`
          SELECT 
            COALESCE(SUM(ads_income), 0) as ads,
            COALESCE(SUM(amazon_income), 0) as amazon,
            COALESCE(SUM(other_income), 0) as other,
            COALESCE(SUM(cost), 0) as site_cost,
            COALESCE(SUM(articles_count), 0) as articles
          FROM monthly_site_metrics
          WHERE month_key = ?
        `).get(monthKey);

        const expRow = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as ledger_cost
          FROM expenses_ledger
          WHERE month_key = ?
        `).get(monthKey);

        const totalIncome = (row.ads || 0) + (row.amazon || 0) + (row.other || 0);
        const totalCost = (row.site_cost || 0) + (expRow.ledger_cost || 0);
        const profit = totalIncome - totalCost;

        return {
          income: totalIncome,
          cost: totalCost,
          profit,
          ads: row.ads || 0,
          amazon: row.amazon || 0,
          other: row.other || 0,
          articles: row.articles || 0
        };
      }

      function getMetricsForYear(yearPrefix) {
        const row = db.prepare(`
          SELECT 
            COALESCE(SUM(ads_income), 0) as ads,
            COALESCE(SUM(amazon_income), 0) as amazon,
            COALESCE(SUM(other_income), 0) as other,
            COALESCE(SUM(cost), 0) as site_cost
          FROM monthly_site_metrics
          WHERE month_key LIKE ?
        `).get(`${yearPrefix}%`);

        const expRow = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as ledger_cost
          FROM expenses_ledger
          WHERE month_key LIKE ?
        `).get(`${yearPrefix}%`);

        const totalIncome = (row.ads || 0) + (row.amazon || 0) + (row.other || 0);
        const totalCost = (row.site_cost || 0) + (expRow.ledger_cost || 0);
        return { income: totalIncome, cost: totalCost, profit: totalIncome - totalCost };
      }

      function getLifetimeMetrics() {
        const row = db.prepare(`
          SELECT 
            COALESCE(SUM(ads_income), 0) as ads,
            COALESCE(SUM(amazon_income), 0) as amazon,
            COALESCE(SUM(other_income), 0) as other,
            COALESCE(SUM(cost), 0) as site_cost
          FROM monthly_site_metrics
        `).get();

        const expRow = db.prepare(`
          SELECT COALESCE(SUM(amount), 0) as ledger_cost
          FROM expenses_ledger
        `).get();

        const totalIncome = (row.ads || 0) + (row.amazon || 0) + (row.other || 0);
        const totalCost = (row.site_cost || 0) + (expRow.ledger_cost || 0);
        return { income: totalIncome, cost: totalCost, profit: totalIncome - totalCost };
      }

      const thisMonth = getMetricsForMonth(currentMonthKey);
      const lastMonth = getMetricsForMonth(lastMonthKey);
      const thisYear = getMetricsForYear(thisYearPrefix);
      const lastYear = getMetricsForYear(lastYearPrefix);
      const lifetime = getLifetimeMetrics();

      // Status counts
      const statusRows = db.prepare(`
        SELECT status, COUNT(*) as count
        FROM sites
        GROUP BY status
      `).all();

      const statusCounts = { running: 0, penalty: 0, deleted: 0, sold: 0 };
      for (const r of statusRows) {
        if (statusCounts[r.status] !== undefined) statusCounts[r.status] = r.count;
      }
      const totalSites = db.prepare('SELECT COUNT(*) as count FROM sites').get().count;

      // 12-Month Trend calculation
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

      // Top Sites for Selected Month
      const topSites = db.prepare(`
        SELECT 
          s.id, s.site_url, s.site_name, s.username, s.status,
          COALESCE(m.ads_income, 0) as ads,
          COALESCE(m.amazon_income, 0) as amazon,
          COALESCE(m.other_income, 0) as other,
          (COALESCE(m.ads_income, 0) + COALESCE(m.amazon_income, 0) + COALESCE(m.other_income, 0)) as total_income,
          COALESCE(m.cost, 0) as cost,
          ((COALESCE(m.ads_income, 0) + COALESCE(m.amazon_income, 0) + COALESCE(m.other_income, 0)) - COALESCE(m.cost, 0)) as profit
        FROM sites s
        LEFT JOIN monthly_site_metrics m ON s.id = m.site_id AND m.month_key = ?
        ORDER BY total_income DESC
        LIMIT 5
      `).all(currentMonthKey);

      // Days left in selected month calculation
      const daysInMonth = new Date(curYear, curMonth, 0).getDate();
      let daysLeft = daysInMonth;
      if (curYear === now.getFullYear() && (curMonth - 1) === now.getMonth()) {
        daysLeft = Math.max(1, daysInMonth - now.getDate());
      }

      const goalSites = parseInt(getSetting('goal_sites', '500'), 10);
      const goalMonthlyIncome = parseFloat(getSetting('goal_monthly_income', '15000'));
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
        totalSites,
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

    // API: SITES LIST WITH MONTH METRICS
    if (pathname === '/api/sites' && req.method === 'GET') {
      const monthKey = parsedUrl.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      const search = (parsedUrl.searchParams.get('search') || '').trim().toLowerCase();
      const status = (parsedUrl.searchParams.get('status') || '').trim();

      let query = `
        SELECT 
          s.id,
          s.site_url,
          s.site_name,
          s.username,
          s.status,
          COALESCE(s.domain_registrar, '') as domain_registrar,
          COALESCE(s.hosting_provider, '') as hosting_provider,
          COALESCE(s.domain_expiry, '') as domain_expiry,
          COALESCE(s.amazon_account, '') as amazon_account,
          COALESCE(s.amazon_tracking_id, '') as amazon_tracking_id,
          COALESCE(m.articles_count, 0) as articles_count,
          COALESCE(m.cost, 0) as cost,
          COALESCE(m.ads_income, 0) as ads_income,
          COALESCE(m.amazon_income, 0) as amazon_income,
          COALESCE(m.other_income, 0) as other_income,
          (COALESCE(m.ads_income, 0) + COALESCE(m.amazon_income, 0) + COALESCE(m.other_income, 0)) as total_income,
          ((COALESCE(m.ads_income, 0) + COALESCE(m.amazon_income, 0) + COALESCE(m.other_income, 0)) - COALESCE(m.cost, 0)) as profit,
          COALESCE(m.notes, '') as notes
        FROM sites s
        LEFT JOIN monthly_site_metrics m ON s.id = m.site_id AND m.month_key = ?
        WHERE 1=1
      `;
      const params = [monthKey];

      if (status && status !== 'all') {
        query += ` AND s.status = ?`;
        params.push(status);
      }

      if (search) {
        query += ` AND (LOWER(s.site_url) LIKE ? OR LOWER(s.site_name) LIKE ? OR LOWER(s.username) LIKE ?)`;
        const wild = `%${search}%`;
        params.push(wild, wild, wild);
      }

      query += ` ORDER BY s.id ASC`;

      const rows = db.prepare(query).all(...params);
      return sendJson(res, 200, { success: true, month: monthKey, count: rows.length, sites: rows });
    }

    // API: ADD NEW SITE
    if (pathname === '/api/sites' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.site_url) {
        return sendJson(res, 400, { success: false, error: 'site_url is required' });
      }

      let formattedUrl = body.site_url.trim();
      if (!/^https?:\/\//i.test(formattedUrl)) {
        formattedUrl = 'https://' + formattedUrl;
      }
      if (!formattedUrl.endsWith('/')) {
        formattedUrl += '/';
      }

      let siteName = body.site_name || '';
      if (!siteName) {
        try {
          siteName = new URL(formattedUrl).hostname.replace(/^www\./, '');
        } catch {
          siteName = formattedUrl;
        }
      }

      const username = body.username || '';
      const status = body.status || 'running';
      const domain_registrar = body.domain_registrar || '';
      const hosting_provider = body.hosting_provider || '';
      const domain_expiry = body.domain_expiry || '';
      const amazon_account = body.amazon_account || '';
      const amazon_tracking_id = body.amazon_tracking_id || '';
      const monthKey = body.month_key || new Date().toISOString().slice(0, 7);

      try {
        const stmt = db.prepare(`
          INSERT INTO sites (site_url, site_name, username, status, domain_registrar, hosting_provider, domain_expiry, amazon_account, amazon_tracking_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const resInsert = stmt.run(formattedUrl, siteName, username, status, domain_registrar, hosting_provider, domain_expiry, amazon_account, amazon_tracking_id);
        const siteId = resInsert.lastInsertRowid;

        // Initialize metrics row
        db.prepare(`
          INSERT OR IGNORE INTO monthly_site_metrics (site_id, month_key, articles_count, cost, ads_income, amazon_income, other_income)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(siteId, monthKey, body.articles_count || 0, body.cost || 0, body.ads_income || 0, body.amazon_income || 0, 0);

        autoBackup();
        return sendJson(res, 201, { success: true, siteId, message: 'Site added successfully' });
      } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
          return sendJson(res, 409, { success: false, error: 'This website URL is already added to your portfolio! (Duplicate URL)' });
        }
        throw err;
      }
    }

    // API: UPDATE SITE DETAILS
    if (pathname.startsWith('/api/sites/') && req.method === 'PUT') {
      const id = parseInt(pathname.split('/')[3], 10);
      const body = await parseJsonBody(req);

      const updates = [];
      const params = [];

      if (body.site_url !== undefined) {
        updates.push('site_url = ?');
        params.push(body.site_url);
      }
      if (body.site_name !== undefined) {
        updates.push('site_name = ?');
        params.push(body.site_name);
      }
      if (body.username !== undefined) {
        updates.push('username = ?');
        params.push(body.username);
      }
      if (body.status !== undefined) {
        updates.push('status = ?');
        params.push(body.status);
      }
      if (body.domain_registrar !== undefined) {
        updates.push('domain_registrar = ?');
        params.push(body.domain_registrar);
      }
      if (body.hosting_provider !== undefined) {
        updates.push('hosting_provider = ?');
        params.push(body.hosting_provider);
      }
      if (body.domain_expiry !== undefined) {
        updates.push('domain_expiry = ?');
        params.push(body.domain_expiry);
      }
      if (body.amazon_account !== undefined) {
        updates.push('amazon_account = ?');
        params.push(body.amazon_account);
      }
      if (body.amazon_tracking_id !== undefined) {
        updates.push('amazon_tracking_id = ?');
        params.push(body.amazon_tracking_id);
      }

      if (updates.length === 0) {
        return sendJson(res, 400, { success: false, error: 'No fields to update' });
      }

      updates.push("updated_at = datetime('now')");
      params.push(id);

      db.prepare(`UPDATE sites SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      autoBackup();
      return sendJson(res, 200, { success: true, message: 'Site updated successfully' });
    }

    // API: DELETE SITE
    if (pathname.startsWith('/api/sites/') && req.method === 'DELETE') {
      const id = parseInt(pathname.split('/')[3], 10);
      db.prepare('DELETE FROM sites WHERE id = ?').run(id);
      autoBackup();
      return sendJson(res, 200, { success: true, message: 'Site deleted successfully' });
    }

    // API: UPDATE METRICS FOR A SITE IN A MONTH (INLINE EDIT / AUTO-SAVE)
    if (pathname === '/api/metrics/update' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { site_id, month_key } = body;

      if (!site_id || !month_key) {
        return sendJson(res, 400, { success: false, error: 'site_id and month_key are required' });
      }

      const articles_count = body.articles_count !== undefined ? parseInt(body.articles_count, 10) : 0;
      const cost = body.cost !== undefined ? parseFloat(body.cost) : 0;
      const ads_income = body.ads_income !== undefined ? parseFloat(body.ads_income) : 0;
      const amazon_income = body.amazon_income !== undefined ? parseFloat(body.amazon_income) : 0;
      const other_income = body.other_income !== undefined ? parseFloat(body.other_income) : 0;
      const notes = body.notes !== undefined ? String(body.notes) : '';

      db.prepare(`
        INSERT INTO monthly_site_metrics (site_id, month_key, articles_count, cost, ads_income, amazon_income, other_income, notes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(site_id, month_key) DO UPDATE SET
          articles_count = excluded.articles_count,
          cost = excluded.cost,
          ads_income = excluded.ads_income,
          amazon_income = excluded.amazon_income,
          other_income = excluded.other_income,
          notes = excluded.notes,
          updated_at = datetime('now')
      `).run(site_id, month_key, articles_count, cost, ads_income, amazon_income, other_income, notes);

      autoBackup();
      return sendJson(res, 200, { success: true, message: 'Metrics saved to database' });
    }

    // API: EXPENSES LEDGER (GET / POST / DELETE)
    if (pathname === '/api/expenses' && req.method === 'GET') {
      const monthKey = parsedUrl.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      const range = parsedUrl.searchParams.get('range') || 'thisMonth';

      let query = `
        SELECT e.*, s.site_name, s.site_url
        FROM expenses_ledger e
        LEFT JOIN sites s ON e.site_id = s.id
        WHERE 1=1
      `;
      const params = [];

      if (range === 'thisMonth') {
        query += ` AND e.month_key = ?`;
        params.push(monthKey);
      } else if (range === 'lastMonth') {
        const [y, m] = monthKey.split('-').map(Number);
        const lm = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
        query += ` AND e.month_key = ?`;
        params.push(lm);
      } else if (range === 'thisYear') {
        query += ` AND e.month_key LIKE ?`;
        params.push(`${monthKey.slice(0, 4)}%`);
      }

      query += ` ORDER BY e.expense_date DESC, e.id DESC`;

      const expenses = db.prepare(query).all(...params);
      const totalAmount = expenses.reduce((acc, x) => acc + (x.amount || 0), 0);

      return sendJson(res, 200, { success: true, count: expenses.length, totalAmount, expenses });
    }

    if (pathname === '/api/expenses' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      const { expense_date, category, title, amount } = body;

      if (!expense_date || !category || !title || amount === undefined) {
        return sendJson(res, 400, { success: false, error: 'expense_date, category, title and amount are required' });
      }

      const month_key = body.month_key || expense_date.slice(0, 7);
      const site_id = body.site_id ? parseInt(body.site_id, 10) : null;
      const receipt_url = body.receipt_url || '';

      const stmt = db.prepare(`
        INSERT INTO expenses_ledger (expense_date, month_key, site_id, category, title, amount, receipt_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const resInsert = stmt.run(expense_date, month_key, site_id, category, title, parseFloat(amount), receipt_url);

      autoBackup();
      return sendJson(res, 201, { success: true, expenseId: resInsert.lastInsertRowid, message: 'Expense added to ledger' });
    }

    if (pathname.startsWith('/api/expenses/') && req.method === 'DELETE') {
      const id = parseInt(pathname.split('/')[3], 10);
      db.prepare('DELETE FROM expenses_ledger WHERE id = ?').run(id);
      autoBackup();
      return sendJson(res, 200, { success: true, message: 'Expense entry deleted' });
    }

    // API: CSV EXPORT
    if (pathname === '/api/export/csv' && req.method === 'GET') {
      const type = parsedUrl.searchParams.get('type') || 'sites';
      const monthKey = parsedUrl.searchParams.get('month') || new Date().toISOString().slice(0, 7);

      if (type === 'sites') {
        const rows = db.prepare(`
          SELECT 
            s.id, s.site_url, s.site_name, s.username, s.status,
            COALESCE(s.domain_registrar, '') as domain_registrar,
            COALESCE(s.hosting_provider, '') as hosting_provider,
            COALESCE(s.domain_expiry, '') as domain_expiry,
            COALESCE(s.amazon_account, '') as amazon_account,
            COALESCE(s.amazon_tracking_id, '') as amazon_tracking_id,
            COALESCE(m.articles_count, 0) as articles,
            COALESCE(m.cost, 0) as cost,
            COALESCE(m.ads_income, 0) as ads_income,
            COALESCE(m.amazon_income, 0) as amazon_income,
            COALESCE(m.other_income, 0) as other_income,
            (COALESCE(m.ads_income, 0) + COALESCE(m.amazon_income, 0) + COALESCE(m.other_income, 0)) as total_income,
            ((COALESCE(m.ads_income, 0) + COALESCE(m.amazon_income, 0) + COALESCE(m.other_income, 0)) - COALESCE(m.cost, 0)) as profit
          FROM sites s
          LEFT JOIN monthly_site_metrics m ON s.id = m.site_id AND m.month_key = ?
          ORDER BY s.id ASC
        `).all(monthKey);

        let csv = 'ID,Site URL,Site Name,Username,Status,Domain Registrar,Hosting Provider,Domain Expiry,Amazon Account,Amazon Tracking ID,Articles,Cost (USD),Ads Income (USD),Amazon Income (USD),Other Income (USD),Total Income (USD),Net Profit (USD)\n';
        for (const r of rows) {
          csv += `"${r.id}","${r.site_url}","${r.site_name}","${r.username}","${r.status}","${r.domain_registrar}","${r.hosting_provider}","${r.domain_expiry}","${r.amazon_account}","${r.amazon_tracking_id}",${r.articles},${r.cost},${r.ads_income},${r.amazon_income},${r.other_income},${r.total_income},${r.profit}\n`;
        }

        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="writerify_portfolio_${monthKey}.csv"`
        });
        return res.end(csv);
      } else {
        const expenses = db.prepare(`
          SELECT e.*, s.site_name
          FROM expenses_ledger e
          LEFT JOIN sites s ON e.site_id = s.id
          ORDER BY e.expense_date DESC
        `).all();

        let csv = 'ID,Date,Month,Site Name,Category,Title,Amount (USD),Receipt URL\n';
        for (const e of expenses) {
          csv += `"${e.id}","${e.expense_date}","${e.month_key}","${e.site_name || 'Global'}","${e.category}","${e.title.replace(/"/g, '""')}",${e.amount},"${e.receipt_url}"\n`;
        }

        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="writerify_expenses_ledger.csv"`
        });
        return res.end(csv);
      }
    }

    // API: BACKUP DOWNLOAD & RESTORE
    if (pathname === '/api/backup/export' && req.method === 'GET') {
      const sites = db.prepare('SELECT * FROM sites').all();
      const metrics = db.prepare('SELECT * FROM monthly_site_metrics').all();
      const expenses = db.prepare('SELECT * FROM expenses_ledger').all();
      const settings = db.prepare('SELECT * FROM settings').all();

      const dump = {
        app: 'Writerify Finance Command Center',
        version: '2.0.0',
        exported_at: new Date().toISOString(),
        settings,
        sites,
        metrics,
        expenses
      };

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="writerify_finance_full_backup_${Date.now()}.json"`
      });
      return res.end(JSON.stringify(dump, null, 2));
    }

    if (pathname === '/api/backup/restore' && req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.sites || !Array.isArray(body.sites)) {
        return sendJson(res, 400, { success: false, error: 'Invalid backup structure' });
      }

      // Create pre-restore safety snapshot
      autoBackup();

      db.exec('BEGIN TRANSACTION;');
      try {
        if (body.settings && Array.isArray(body.settings)) {
          for (const s of body.settings) {
            setSetting(s.key, s.value);
          }
        }

        // Restore sites
        db.prepare('DELETE FROM monthly_site_metrics').run();
        db.prepare('DELETE FROM expenses_ledger').run();
        db.prepare('DELETE FROM sites').run();

        const insertSite = db.prepare(`
          INSERT INTO sites (id, site_url, site_name, username, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const s of body.sites) {
          insertSite.run(s.id, s.site_url, s.site_name, s.username || '', s.status || 'running', s.created_at || new Date().toISOString(), s.updated_at || new Date().toISOString());
        }

        // Restore metrics
        if (body.metrics && Array.isArray(body.metrics)) {
          const insertMetric = db.prepare(`
            INSERT INTO monthly_site_metrics (site_id, month_key, articles_count, cost, ads_income, amazon_income, other_income, notes, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const m of body.metrics) {
            insertMetric.run(m.site_id, m.month_key, m.articles_count || 0, m.cost || 0, m.ads_income || 0, m.amazon_income || 0, m.other_income || 0, m.notes || '', m.updated_at || new Date().toISOString());
          }
        }

        // Restore expenses
        if (body.expenses && Array.isArray(body.expenses)) {
          const insertExp = db.prepare(`
            INSERT INTO expenses_ledger (expense_date, month_key, site_id, category, title, amount, receipt_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          for (const e of body.expenses) {
            insertExp.run(e.expense_date, e.month_key, e.site_id || null, e.category, e.title, e.amount, e.receipt_url || '', e.created_at || new Date().toISOString());
          }
        }

        db.exec('COMMIT;');
        autoBackup();
        return sendJson(res, 200, { success: true, message: 'Database successfully restored from backup snapshot' });
      } catch (err) {
        db.exec('ROLLBACK;');
        return sendJson(res, 500, { success: false, error: 'Restore failed: ' + err.message });
      }
    }

    // STATIC FILE SERVING
    let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
    if (!filePath.startsWith(path.join(__dirname, 'public'))) {
      return sendText(res, 403, 'Forbidden');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes = {
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(filePath).pipe(res);
    }

    // Default fallback to index.html for SPA routes
    const indexPath = path.join(__dirname, 'public', 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(indexPath).pipe(res);
    }

    return sendText(res, 404, 'Not Found');

  } catch (err) {
    console.error('Server Internal Error:', err);
    return sendJson(res, 500, { success: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`========================================================`);
  console.log(`👑 WRITERIFY PORTFOLIO & REVENUE COMMAND CENTER`);
  console.log(`🚀 Live URL: http://localhost:${PORT}`);
  console.log(`💾 Database: ${DB_PATH} (SQLite WAL Mode Active)`);
  console.log(`🛡️ Auto-Backups: ${BACKUPS_DIR}`);
  console.log(`========================================================`);
});
