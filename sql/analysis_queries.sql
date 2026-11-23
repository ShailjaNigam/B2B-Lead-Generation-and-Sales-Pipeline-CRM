-- =====================================================================
-- B2B Lead Generation & Sales Pipeline - analysis queries (MySQL 8)
-- Report date fixed to the data snapshot; use CURDATE() for live tracking.
-- =====================================================================
USE B2B_Sales_DB;
SET @report_date = '2026-11-23';

-- Q1. Hot leads (score >= 75) that are still open - who should the team call first?
SELECT l.lead_id, l.company_name, l.industry, l.lead_score, l.status, s.sales_name
FROM Leads l JOIN Sales_Representatives s ON s.sales_id = l.sales_id
WHERE l.lead_score >= 75 AND l.status NOT IN ('Won', 'Lost')
ORDER BY l.lead_score DESC, l.lead_date;

-- Q2. Leads by industry, with qualification and conversion rates
SELECT l.industry,
       COUNT(*)                                                         AS total_leads,
       SUM(ps.stage_order >= 3)                                         AS qualified_leads,
       SUM(l.status = 'Won')                                            AS customers,
       ROUND(100 * SUM(l.status = 'Won') / COUNT(*), 1)                 AS conversion_rate_pct
FROM Leads l JOIN Pipeline_Stages ps ON ps.stage = l.max_stage_reached
GROUP BY l.industry
ORDER BY total_leads DESC;

-- Q3. Sales pipeline value by stage (open deals only)
SELECT o.stage, COUNT(*) AS opportunities, SUM(o.deal_value) AS total_value
FROM Opportunities o JOIN Pipeline_Stages ps ON ps.stage = o.stage
WHERE o.stage NOT IN ('Won', 'Lost')
GROUP BY o.stage, ps.stage_order
ORDER BY ps.stage_order;

-- Q4. Weighted pipeline revenue (probability stored as 0-100)
SELECT SUM(deal_value * probability / 100) AS weighted_pipeline
FROM Opportunities
WHERE stage NOT IN ('Won', 'Lost');

-- Q5. Follow-ups: LATEST activity per open lead only (the brief's version also returned old, completed follow-ups)
WITH latest AS (
  SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.lead_id ORDER BY a.activity_date DESC, a.activity_id DESC) AS rn
  FROM Activities a
)
SELECT l.company_name, s.sales_name, la.activity_date AS last_contact, la.activity_type, la.next_followup,
       CASE WHEN la.next_followup < @report_date THEN 'Overdue'
            WHEN la.next_followup = @report_date THEN 'Due today'
            ELSE 'Upcoming' END AS followup_status
FROM latest la
JOIN Leads l ON l.lead_id = la.lead_id
JOIN Sales_Representatives s ON s.sales_id = la.sales_id
WHERE la.rn = 1 AND l.status NOT IN ('Won', 'Lost') AND la.next_followup IS NOT NULL
ORDER BY la.next_followup;

-- Q6. Headline KPIs in one row
SELECT COUNT(*)                                                    AS total_leads,
       SUM(ps.stage_order >= 3)                                    AS qualified_leads,
       SUM(l.lead_category = 'Hot')                                AS hot_leads,
       SUM(l.status = 'Won')                                       AS customers,
       ROUND(100 * SUM(l.status = 'Won') / COUNT(*), 1)            AS conversion_rate_pct,
       ROUND(100 * SUM(l.status = 'Won') / SUM(l.status IN ('Won', 'Lost')), 1) AS win_rate_pct,
       (SELECT SUM(deal_value) FROM Opportunities WHERE stage NOT IN ('Won', 'Lost'))                     AS pipeline_value,
       (SELECT SUM(deal_value * probability / 100) FROM Opportunities WHERE stage NOT IN ('Won', 'Lost')) AS weighted_pipeline,
       (SELECT SUM(deal_value) FROM Opportunities WHERE stage = 'Won')                                     AS revenue_won
FROM Leads l JOIN Pipeline_Stages ps ON ps.stage = l.max_stage_reached;

-- Q7. Conversion funnel: leads that REACHED each stage, and drop-off from the previous stage
WITH reached AS (
  SELECT ps.stage, ps.stage_order,
         (SELECT COUNT(*) FROM Leads l JOIN Pipeline_Stages m ON m.stage = l.max_stage_reached
          WHERE m.stage_order >= ps.stage_order) AS leads_reached
  FROM Pipeline_Stages ps WHERE ps.stage_order > 0
)
SELECT stage, leads_reached,
       ROUND(100 * leads_reached / FIRST_VALUE(leads_reached) OVER (ORDER BY stage_order), 1)  AS pct_of_all_leads,
       ROUND(100 * (1 - leads_reached / LAG(leads_reached) OVER (ORDER BY stage_order)), 1)    AS drop_off_pct
FROM reached ORDER BY stage_order;

-- Q8. Which lead source brings QUALITY leads (not just volume)?
SELECT l.lead_source,
       COUNT(*)                                                AS leads,
       SUM(ps.stage_order >= 3)                                AS qualified,
       SUM(l.status = 'Won')                                   AS won,
       ROUND(100 * SUM(ps.stage_order >= 3) / COUNT(*), 1)     AS qualification_rate_pct,
       ROUND(100 * SUM(l.status = 'Won') / COUNT(*), 1)        AS conversion_rate_pct
FROM Leads l JOIN Pipeline_Stages ps ON ps.stage = l.max_stage_reached
GROUP BY l.lead_source
ORDER BY conversion_rate_pct DESC;

-- Q9. Sales representative scorecard
SELECT s.sales_name, s.region,
       COUNT(l.lead_id)                                                          AS leads_assigned,
       SUM(l.status = 'Won')                                                     AS deals_won,
       ROUND(100 * SUM(l.status = 'Won') / NULLIF(SUM(l.status IN ('Won','Lost')), 0), 1) AS win_rate_pct,
       ROUND(100 * SUM(l.status = 'Won') / COUNT(l.lead_id), 1)                  AS conversion_rate_pct,
       COALESCE(SUM(CASE WHEN o.stage = 'Won' THEN o.deal_value END), 0)         AS revenue_won,
       COALESCE(SUM(CASE WHEN o.stage NOT IN ('Won','Lost') THEN o.deal_value * o.probability / 100 END), 0) AS weighted_open_pipeline
FROM Sales_Representatives s
LEFT JOIN Leads l ON l.sales_id = s.sales_id
LEFT JOIN Opportunities o ON o.lead_id = l.lead_id
GROUP BY s.sales_id, s.sales_name, s.region
ORDER BY revenue_won DESC;

-- Q10. Monthly lead generation and how many of each month's leads were won
SELECT DATE_FORMAT(lead_date, '%Y-%m') AS lead_month, COUNT(*) AS new_leads, SUM(status = 'Won') AS won_so_far
FROM Leads
GROUP BY DATE_FORMAT(lead_date, '%Y-%m')
ORDER BY lead_month;

-- Q11. Average sales cycle (days from lead to won deal) by industry
SELECT l.industry, COUNT(*) AS won_deals, ROUND(AVG(DATEDIFF(o.close_date, l.lead_date)), 0) AS avg_days_to_close,
       ROUND(AVG(o.deal_value), 0) AS avg_deal_value
FROM Opportunities o JOIN Leads l ON l.lead_id = o.lead_id
WHERE o.stage = 'Won'
GROUP BY l.industry
ORDER BY avg_days_to_close;

-- Q12. Open leads with no activity in the last 14 days (including never-contacted leads)
SELECT l.lead_id, l.company_name, s.sales_name, l.status, l.lead_category,
       MAX(a.activity_date) AS last_activity,
       DATEDIFF(@report_date, COALESCE(MAX(a.activity_date), l.lead_date)) AS days_idle
FROM Leads l
JOIN Sales_Representatives s ON s.sales_id = l.sales_id
LEFT JOIN Activities a ON a.lead_id = l.lead_id
WHERE l.status NOT IN ('Won', 'Lost')
GROUP BY l.lead_id, l.company_name, s.sales_name, l.status, l.lead_category, l.lead_date
HAVING days_idle >= 14
ORDER BY days_idle DESC;

-- Q13. Why do we lose deals? Lost reasons by the stage the lead was lost at
SELECT lost_at_stage, lost_reason, COUNT(*) AS lost_leads
FROM Leads
WHERE status = 'Lost'
GROUP BY lost_at_stage, lost_reason
ORDER BY lost_leads DESC;

-- Q14. Does the lead score work? Conversion rate by category
SELECT lead_category, COUNT(*) AS leads, SUM(status = 'Won') AS won,
       ROUND(100 * SUM(status = 'Won') / COUNT(*), 1) AS conversion_rate_pct
FROM Leads
GROUP BY lead_category
ORDER BY conversion_rate_pct DESC;

-- Q15. Outreach cadence: reply rate at each step (Day 1 / 3 / 7 / 10 / 14)
SELECT cadence_step, COUNT(*) AS touches, SUM(outcome = 'Replied') AS replies,
       ROUND(100 * SUM(outcome = 'Replied') / COUNT(*), 1) AS reply_rate_pct
FROM Activities
WHERE cadence_step IS NOT NULL
GROUP BY cadence_step
ORDER BY cadence_step;

-- Q16. Won vs Lost opportunities (count and value)
SELECT stage AS outcome, COUNT(*) AS opportunities, SUM(deal_value) AS total_value
FROM Opportunities WHERE stage IN ('Won', 'Lost') GROUP BY stage;
