---
title: "B2B Lead Generation and Sales Pipeline Management"
subtitle: "Project report: PeopleFirst CRM, a mini CRM and sales analytics system"
---

# 1. Business problem

**PeopleFirst HR** is a fictional company that sells HR Management Software to other businesses (B2B). Its target industries are IT, startups, finance, manufacturing and e-commerce, across six Indian cities.

The sales team needs one system that answers six questions:

1. Which companies could become customers?
2. Who should we contact first?
3. How many leads convert?
4. Which sales reps perform well?
5. How much revenue is in the pipeline?
6. Which leads need attention today?

**What was built:** a working mini CRM with a sales analytics layer:

- a Python data pipeline that generates, cleans and scores the data
- a MySQL database with 16 analysis queries
- an Excel tracker with live formulas
- DAX measures and a step-by-step build guide for a Power BI dashboard
- an interactive web CRM (HTML, CSS, JavaScript) with a Flask API

# 2. Architecture

```
Data generation (Python)  ->  Cleaning + lead scoring (Python/pandas)  ->  dataset/*.csv
        |                                                                   |
        v                                                                   v
Excel tracker (formulas)      MySQL B2B_Sales_DB (16 queries)      Power BI (DAX, 5 pages)
                                         |
                                         v
                  Flask REST API  <->  Web CRM (dashboard, leads, pipeline board, follow-ups, reports, outreach)
```

| Technology | What it does in this project |
|---|---|
| Python (pandas) | Generates 500 synthetic leads; cleans 10 kinds of data problems; scores and classifies every lead |
| Excel | Lead database, follow-up tracker and sales pipeline sheets; 3,710 live formulas; dropdowns; conditional formatting |
| MySQL | 6 related tables with primary and foreign keys; 16 queries (joins, window functions, CTEs, aggregation) |
| Power BI / DAX | 6 calculated columns, 25 measures (including a funnel measure that counts stages *reached*), 5 report pages |
| HTML / CSS / JavaScript | 7-page single-page CRM: works offline by double-clicking `index.html`, with drag-and-drop pipeline and live lead scoring |
| Flask | REST API (`/api/leads`, `/api/activities`, `/api/opportunities`, `/api/kpis`, `/api/followups`); serves the CRM; SQLite by default, MySQL optional |

# 3. Data

All data is **synthetic**. Every company, person, email and phone number is fictional, and emails use the reserved `example.com` domain. Real contact details were deliberately not collected or invented.

The generator simulates each lead's journey through the pipeline:

- **Outreach cadence:** Day 1, 3, 7, 10, 14
- **Stage progression:** stage-by-stage with realistic timing
- **What drives success:** conversion depends on lead source, industry, company size, whether a decision-maker is known, and the rep's skill

| Table | Rows | Purpose |
|---|---|---|
| Leads | 500 | Company, industry, location, size, source, rep, current stage, furthest stage reached, score |
| Contacts | 673 | 1–2 contacts per lead, with designation and email/phone validity |
| Sales_Representatives | 6 | Reps and regions |
| Activities | 2,102 | Emails, calls, meetings, proposals; outcome, cadence step and next follow-up date |
| Opportunities | 174 | Deal value, stage, probability (0–100), created and close dates, lost reason |
| Pipeline_Stages | 8 | Stage order and default probability |

**Data cleaning (`python/data_cleaning.py`)** fixed these problems in the raw data:

- 35 inconsistent city names (case, extra spaces, and aliases such as Bengaluru and Bombay)
- 15 inconsistent industry values
- 32 lead-source typos
- 25 dates in dd/mm/yyyy format
- **12 duplicate leads**
- 10 missing employee counts (filled with the industry median)
- 191 phone numbers in non-standard formats (13 were invalid and blanked)
- 20 invalid emails (flagged, not deleted)

The script also runs referential-integrity checks between tables. Its full output is in `dataset/cleaning_log.txt`.

**Design fixes compared with the original brief:**

- **One stage list.** The brief used one status list for follow-ups and another for the pipeline. They are merged into a single list.
- **Probability stored as 0–100.** The brief showed "60%" in Excel but divided by 100 in SQL.
- **A `max_stage_reached` column.** Without it, the funnel can only count each lead's *current* stage, which gives a wrong funnel shape.
- **Follow-ups use each lead's latest activity only.** The brief's query also returned old follow-ups that had already been done.

# 4. Lead scoring

| Criterion | Points |
|---|---|
| Company has more than 200 employees | 25 |
| Target industry (IT, Startup, Finance, Manufacturing, E-commerce) | 20 |
| Decision-maker identified (CEO, Founder, CHRO, HR Head/Director/Manager) | 20 |
| Has expressed interest (replied, booked a meeting, or later stages) | 25 |
| Valid business contact information (valid email **and** phone) | 10 |

Categories: **Hot** 75–100, **Warm** 40–74, **Cold** 0–39.

The same rule is used in all four places: in Python (`lead_scoring.py`), as an Excel formula, in the web app (as a live preview while adding a lead) and in the Flask API. The Excel scores match the Python scores on all 500 leads.

**Result:** Hot leads convert at **20.8%**, Warm at **3.8%** and Cold at **0%**.

*Caveat:* "expressed interest" is part of the score, so some of this lift is built in. A real company would calibrate the weights on historical conversions, for example with logistic regression.

# 5. Results (report date 23 Nov 2026)

| KPI | Value |
|---|---|
| Total leads | 500 (120 still open) |
| Qualified leads (reached Qualified) | 174 (34.8%) |
| Hot leads | 178 |
| Converted customers | 45 |
| Conversion rate / win rate | 9.0% / 11.8% |
| Open pipeline / weighted pipeline | ₹1.73 Cr / ₹66.4L |
| Revenue won | ₹2.46 Cr |
| Overdue follow-ups | 17, plus 2 due today |

**Funnel (leads that reached each stage):**

| Stage | Leads | Drop-off from previous stage |
|---|---|---|
| New Lead | 500 | — |
| Contacted | 441 | 12% |
| Qualified | 174 | 61% |
| Meeting Scheduled | 125 | 28% |
| Proposal Sent | 79 | 37% |
| Negotiation | 58 | 27% |
| Won | 45 | 22% |

# 6. Insights and recommendations

1. **Referrals are the best source by far.**
   - Referrals are 9% of leads but 29% of wins: 28.3% conversion vs 4.7% for cold email (6×).
   - Cold email leads qualify at a similar rate (37%) but rarely close.
   - *Action:* start a customer referral program. Tighten qualification for cold-email leads before they take up rep time.
2. **The biggest leak is Contacted → Qualified (−61%), and most losses are "no response".**
   - Replies come from the first three touches (12.6–14.1% reply rate) and fall to 8.6% at Day 10 and 0% at Day 14.
   - *Action:* invest in the first three messages (personalization, timing). Replace the Day 14 "break-up" email with a LinkedIn touch, or drop it.
3. **55 leads were never contacted after more than 2 weeks, and 11 of them are Hot.**
   - *Action:* auto-assign a Day 1 task when a lead is created, and review the "No activity 14+ days" list every week.
4. **Rep performance varies 7× in win rate.**
   - Sneha Kulkarni wins 25% of her closed leads and brings in the most revenue (₹85.5L) from the fewest leads (58).
   - Rahul Verma (5.8% on 93 leads) and Kavya Iyer (3.5%) trail.
   - *Action:* use Sneha's process as the team playbook, coach the bottom two reps, and consider routing more Hot leads to the top closers.
5. **Target industries are the right ones.**
   - Healthcare (3.8%) and Education (2.6%) convert far below IT (12.4%), Startups (10.3%) and Finance (10.0%).
   - IT also closes fastest (54 days vs 91 for Manufacturing).
   - *Action:* deprioritize non-target industries in lead generation.
6. **Follow-up discipline:** 17 open leads have an overdue follow-up, including high-value Hot leads such as Nova Wealth (10 days overdue).
   - *Action:* the "Call these first" list on the dashboard gives reps a daily queue.

# 7. How to run

| What | How |
|---|---|
| Web CRM (offline) | Double-click `frontend/index.html`. Changes are saved in the browser. Use "Reset demo data" to start over. |
| Web CRM + database | `pip install -r requirements.txt` then `python backend/app.py`, and open http://127.0.0.1:5000 |
| Rebuild the data | `cd python`, then run `python data_generation.py`, `python data_cleaning.py`, `python lead_scoring.py` |
| SQL | In MySQL Workbench, run `sql/create_tables.sql`, then `insert_data.sql`, then `analysis_queries.sql` |
| Excel | `excel/B2B_Lead_Management.xlsx`. Blue cells are inputs; the report date is on the Summary sheet |
| Power BI | Follow `powerbi/PowerBI_Build_Guide.md` with `powerbi/DAX_Measures.dax` |

# 8. Resume bullets

**B2B Lead Generation & Sales Pipeline CRM** | Python, SQL (MySQL), Excel, Power BI/DAX, HTML/CSS/JS, Flask

- Built an end-to-end mini CRM for a B2B SaaS scenario:
  - a Python pipeline that generated and cleaned 500 leads (12 duplicates removed, 190+ fields standardized)
  - a 100-point lead-scoring model under which Hot leads converted at 20.8% vs 3.8% for Warm leads
- Designed a 6-table MySQL schema and wrote 16 analysis queries (CTEs, window functions, joins) covering a stage-reached funnel, lead-source quality, rep scorecards and follow-up tracking.
- Created an interactive CRM web app (7 pages, drag-and-drop pipeline, live scoring) backed by a Flask REST API, plus an Excel tracker with 3,700+ formulas and a Power BI model with 25 DAX measures.
- Found that referrals convert at 6× the rate of cold email, that 61% of leads drop out between Contacted and Qualified, and that 55 leads (11 of them Hot) were never contacted; recommended a referral program, cadence changes and lead re-routing.

# 9. Interview questions to prepare

- **Why is the funnel based on stage *reached* rather than current stage?** A lead now in Negotiation also passed through Qualified and Meeting. Counting only current stages understates the early stages and produces an inverted, meaningless funnel.
- **Conversion rate vs win rate?** Conversion = won ÷ all leads, which measures the whole funnel. Win rate = won ÷ (won + lost), which measures how well reps close leads that reached an outcome. Open leads are excluded from win rate.
- **Why weight the pipeline?** Not every open deal will close. Deal value × stage probability gives a realistic revenue forecast (₹66.4L) instead of the optimistic total (₹1.73 Cr).
- **What's wrong with the brief's follow-up query?** It checks every activity, so follow-ups that were already done still show as overdue. The fix uses `ROW_NUMBER() OVER (PARTITION BY lead_id ...)` to keep only the latest activity per lead.
- **How would you improve the score?** Learn the weights from historical won/lost data (logistic regression). Remove the "interested" criterion when the goal is to *predict* conversion before the first contact, because it leaks the outcome into the score.
- **Ethics:** use public company information plus synthetic or consented contact details; respect opt-outs and email rules; never send unsolicited bulk email.

*All companies, people, emails and phone numbers in this project are fictional.*
