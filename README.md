# B2B Lead Generation & Sales Pipeline Management: PeopleFirst CRM

A mini CRM and sales analytics system for a B2B SaaS company that sells HR software to other businesses. It finds and scores prospects, tracks follow-ups, manages the sales pipeline and analyses conversion, revenue and rep performance.

**Stack:** Python (pandas) · MySQL · Excel · Power BI / DAX · HTML, CSS, JavaScript · Flask

![Dashboard](documentation/screenshots/01_dashboard.png)

## Run it in 10 seconds
Double-click **`frontend/index.html`**. No install and no internet needed. The CRM opens with 500 sample leads, and your changes are saved in your browser. **Reset demo data** in the sidebar restores the sample.

To run it with a real database:
```bash
pip install -r requirements.txt
python backend/app.py          # then open http://127.0.0.1:5000
```
The backend creates `backend/crm.db` (SQLite) from the CSVs on its first run. To use MySQL instead, run the SQL scripts first and set `DB_URL=mysql://user:pass@localhost:3306/B2B_Sales_DB`.

## What's inside
| Folder | Contents |
|---|---|
| `dataset/` | Cleaned CSVs: leads (500), contacts (673), sales_reps (6), activities (2,102), opportunities (174), plus `cleaning_log.txt`. Raw, messy files are in `dataset/raw/`. |
| `python/` | `data_generation.py` (synthetic data with realistic patterns), `data_cleaning.py` (10 cleaning steps), `lead_scoring.py` (0–100 score, Hot/Warm/Cold) |
| `sql/` | `create_tables.sql` (6 tables with keys and indexes), `insert_data.sql`, `analysis_queries.sql` (16 queries: funnel, source quality, rep scorecard, follow-ups, sales cycle…) |
| `excel/` | `B2B_Lead_Management.xlsx`: Summary, Lead Database, Follow-up Tracker, Sales Pipeline, with 3,710 live formulas and dropdowns |
| `powerbi/` | `DAX_Measures.dax` and `PowerBI_Build_Guide.md` (5 report pages, with expected numbers to check against) |
| `frontend/` | The CRM: Dashboard, Leads, Lead details, Add lead (live score), Follow-ups, drag-and-drop Pipeline, Reports, Outreach |
| `backend/` | `app.py`: Flask REST API that also serves the frontend |
| `documentation/` | `project_report.pdf` (findings, recommendations, resume bullets), outreach templates, screenshots |

## Rebuild the data from scratch
```bash
cd python
python data_generation.py   # -> dataset/raw/*.csv (deliberately messy)
python data_cleaning.py     # -> dataset/*.csv + cleaning_log.txt
python lead_scoring.py      # -> adds lead_score and lead_category
```
Then regenerate `frontend/js/data.js` if you want the offline CRM to use the new data. The backend reads the CSVs directly.

## Key findings (report date 23 Nov 2026)
- **₹1.73 Cr open pipeline, ₹66.4L weighted.** 45 customers won (9.0% conversion, 11.8% win rate), ₹2.46 Cr revenue.
- **Referrals convert at 6× the rate of cold email** (28.3% vs 4.7%): 9% of leads, but 29% of wins.
- **The biggest leak is Contacted → Qualified (−61%).** Replies come in the first 3 touches; the Day 14 email gets none.
- **55 leads were never contacted after more than 2 weeks, 11 of them Hot.** 17 open leads have an overdue follow-up.
- **Win rate varies 7× across reps** (25% vs 3.5%). The top closer earns the most revenue from the fewest leads.

## Data and ethics
All data is **synthetic**. Companies, people, emails (`example.com`) and phone numbers are fictional. No real contact data was scraped. If you use real leads, use public company information and contact details shared with consent, and respect opt-outs and email rules.
