# 👑 KYROS Portfolio & Revenue Command Center

**Supreme Authority:** Boss TN TAYYAB  
**Custodian:** Messi (Chief AI Manager & Strategist)  
**System Status:** 🟢 Production Ready & Active  
**Live URL:** [http://localhost:5050](http://localhost:5050)

---

## 🚀 Quick Launch
1. **Desktop Shortcut:** Double-click `KYROS Portfolio Command Center.lnk` on your Desktop.
2. **KYROS Root:** Run `D:\KYROS\Start_Portfolio_Command_Center.bat`.
3. **Command Center Folder:** Run `D:\KYROS\08_Portfolio_Command_Center\Start_Portfolio_Command_Center.bat`.

---

## ✨ v4 — Redesigned dashboard + Income section

- **New design system** (light / dark / auto): sidebar workspace nav, hero mission card, stat tiles, SVG trend + donut charts, mobile drawer.
- **Income section** (sidebar → *Income*): log earnings with **Date, Product, Site, Title, Description, Amount**.
  Products: **Writerify, Pinterify, Themixify** or any **custom product** (pick *Other…*).
  Product-wise cards show *total, share, number of sites and entries* — click a card to filter the ledger.
- **Every table** (Sites, Income, Expenses) has: sortable columns, rows per page **10 / 25 / 50 / 100 / All**, numbered pagination (Prev / 1 2 3 … / Next), search,
  and date filters **This month · Last month · Last 30 days · This year · Last year · Lifetime · Custom range**.
- Expenses can now be edited and deleted; the Restore button works (`POST /api/backup/restore`).
- Downloads (CSV / backup) use the Authorization header — no more auth token in the URL.

### One-time database setup for Income
Open **Supabase → SQL Editor**, paste [`supabase_income_migration.sql`](supabase_income_migration.sql) and press **Run**.
Until then the Income section shows the SQL with a *Copy* button and the rest of the app keeps working.

> The Cloudflare Pages function (`functions/api/[[path]].js`) is the live backend. `api/index.js` (Vercel) and `server.mjs` (local SQLite) do not include the Income endpoints.

---

## 🎯 Features & Core Capabilities
1. **Persistent SQLite Database:**
   - Database File: `data/kyros_portfolio.db` (SQLite WAL mode).
   - Zero data loss guarantee: Every change is immediately committed.
   - Automatic JSON safety snapshots saved in `data/backups/`.
2. **Pre-Seeded Sites:**
   - 39 active websites pre-loaded into the database with URLs and author personas.
3. **Monthly Financial Tracking:**
   - **Ad Revenue:** AdSense, Mediavine, Adsterra, Ezoic, Raptive.
   - **Amazon Associates Revenue:** Affiliate earnings per site & total.
   - **Other Income:** Sponsored posts & direct deals.
   - **Per-Site Costs:** Content writers, backlinks, specific renewals.
   - **Net Profit:** Auto-calculated (`Income - Cost`) with green/red status pills.
4. **Detailed Costs Ledger:**
   - Itemized business expense logging for Hosting, Domains, AI tools, VAs, and Plugins.
   - Range filters: `This Month`, `Last Month`, `This Year`, `All-Time`.
   - Automatically factored into the monthly profit calculation.
5. **Interactive Mission Analytics:**
   - Monthly Income Goal Circle Gauge (`$X / $15,000`, pace to goal).
   - Portfolio Scale Circle Gauge (`X / 500 sites`).
   - Daily Run-Rate required calculator (`$X/day needed`).
   - Real-time SVG Income Mix Donut Chart (Ads vs Amazon).
   - 12-Month Performance Trend Chart (Month-by-month Income vs Cost bars).
6. **Data Portability:**
   - One-click CSV Export for Excel.
   - One-click Full JSON Database Backup.
   - One-click Database Restore from JSON snapshot.
