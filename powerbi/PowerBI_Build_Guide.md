# Power BI build guide: `sales_dashboard.pbix`

Power BI Desktop is free and runs on Windows only. Allow 1–2 days. The expected numbers at the end let you check your work.

## 1. Connect

**Option A: MySQL (as in the brief)**
1. Run `sql/create_tables.sql`, then `sql/insert_data.sql`, in MySQL Workbench.
2. In Power BI, go to **Home → Get Data → MySQL database**. Server: `localhost`. Database: `B2B_Sales_DB`.
3. Select all 6 tables: Leads, Contacts, Sales_Representatives, Activities, Opportunities, Pipeline_Stages.
4. If Power BI asks for the MySQL connector, install "MySQL Connector/NET" from the MySQL website.

**Option B: CSV**
1. **Get Data → Text/CSV**, and load each file in `dataset/`: `leads`, `contacts`, `sales_reps`, `activities`, `opportunities`.
2. Create Pipeline_Stages yourself with **Home → Enter data**. Use 3 columns, `stage`, `stage_order` and `default_probability`, and these 8 rows:

   | stage | stage_order | default_probability |
   |---|---|---|
   | New Lead | 1 | 5 |
   | Contacted | 2 | 10 |
   | Qualified | 3 | 20 |
   | Meeting Scheduled | 4 | 35 |
   | Proposal Sent | 5 | 50 |
   | Negotiation | 6 | 75 |
   | Won | 7 | 100 |
   | Lost | 0 | 0 |

## 2. Power Query (Transform Data)

Make these changes in each table:

- Set the date columns to **Date**, `deal_value` to **Fixed decimal**, and `probability` and `lead_score` to **Whole number**.
- Set `decision_maker`, `interested`, `valid_contact` and `valid_email` to **True/False**.
- Text columns: **Transform → Format → Trim**.
- Keep blank `next_followup` and `close_date` values as null. Null means "not set yet".

Then click **Close & Apply**.

## 3. Model view: relationships

| One side | Many side |
|---|---|
| Sales_Representatives[sales_id] | Leads[sales_id] |
| Leads[lead_id] | Contacts[lead_id] |
| Leads[lead_id] | Activities[lead_id] |
| Leads[lead_id] | Opportunities[lead_id] |
| Date[Date] | Leads[lead_date] |

Leave **Pipeline_Stages disconnected**. It is only used as the funnel's axis.

Don't connect Activities[sales_id] to the reps table as well. That would create a second path from reps to the data, and Power BI would report the relationship as ambiguous.

## 4. DAX

Copy everything from `DAX_Measures.dax`:

- **Tables:** Date and Report Date. Mark Date as the date table.
- **Calculated columns:** Max Stage Order, Last Activity Date, Next Follow-up, Follow-up Status, Days Idle, Weighted Value.
- **Measures:** put them all in one empty "Measures" table.

Formats:
- Conversion Rate, Win Rate and Qualification Rate: percentage.
- Money measures: currency (₹).

## 5. Report pages

Put the same slicers on every page: **Date** (Between style), **Industry**, **Location**, **Lead Source**, **Sales Rep**, **Pipeline Stage**. Use **View → Sync slicers** so a selection applies across all pages.

| Page | Visuals |
|---|---|
| A. Overview | 7 cards: Total Leads, Qualified Leads, Hot Leads, Converted Customers, Conversion Rate, Total Pipeline Value, Weighted Pipeline Revenue. Plus a card for the Headline measure. |
| B. Lead generation | Bar: Leads by industry. Map or bar: Leads by location. Donut: Leads by source. Line: Total Leads by Date[Month]. Table: Lead source quality (Total Leads, Qualification Rate, Conversion Rate by source). |
| C. Pipeline | Funnel: Pipeline_Stages[stage] (filter out *Lost*; sort by stage_order) with value *Leads Reached Stage*. Bar: Total Pipeline Value by Opportunities[stage]. Donut: Won vs Lost Opportunities. Card: Weighted Pipeline Revenue as "Expected revenue". |
| D. Sales reps | Matrix with Sales_Representatives[sales_name] as rows and these values: Leads Assigned, Deals Won, Win Rate, Rep Conversion Rate, Revenue Won, Weighted Pipeline Revenue, Avg Days to Close. Add data bars on Win Rate. |
| E. Follow-ups | Cards: Overdue Follow-ups, Follow-ups Due Today, Upcoming Follow-ups, Leads Without Recent Activity. Table: open leads sorted by Next Follow-up, with conditional formatting on Follow-up Status. |

## 6. Check your numbers (no filters applied)

| Measure | Expected |
|---|---|
| Total Leads | 500 |
| Qualified Leads | 174 |
| Hot Leads | 178 |
| Converted Customers | 45 |
| Conversion Rate | 9.0% |
| Win Rate | 11.8% |
| Total Pipeline Value | ₹1,73,45,000 |
| Weighted Pipeline Revenue | ₹66,37,000 |
| Revenue Won | ₹2,45,80,000 |
| Overdue Follow-ups | 17 |
| Funnel (New → Won) | 500 → 441 → 174 → 125 → 79 → 58 → 45 |

The same numbers appear in `sql/analysis_queries.sql` (Q6, Q7), the Excel Summary sheet and the web dashboard. If yours differ, check the data types from step 2 first.

Save the file as `powerbi/sales_dashboard.pbix`. Then export each page as a PNG into `documentation/screenshots/` for your README.
