-- =====================================================================
-- B2B Lead Generation & Sales Pipeline - schema (MySQL 8)
-- Run order: create_tables.sql -> insert_data.sql -> analysis_queries.sql
-- =====================================================================
DROP DATABASE IF EXISTS B2B_Sales_DB;
CREATE DATABASE B2B_Sales_DB;
USE B2B_Sales_DB;

-- Lookup: pipeline stages in order, with default win probability (0-100)
CREATE TABLE Pipeline_Stages (
  stage                VARCHAR(30) PRIMARY KEY,
  stage_order          TINYINT NOT NULL,        -- Lost = 0 so it never counts as progress
  default_probability  TINYINT NOT NULL
);

CREATE TABLE Sales_Representatives (
  sales_id    VARCHAR(5) PRIMARY KEY,
  sales_name  VARCHAR(60) NOT NULL,
  region      VARCHAR(20) NOT NULL,
  base_city   VARCHAR(30)
);

CREATE TABLE Leads (
  lead_id            VARCHAR(6) PRIMARY KEY,
  company_name       VARCHAR(100) NOT NULL,
  industry           VARCHAR(30) NOT NULL,
  location           VARCHAR(30) NOT NULL,
  employees          INT NOT NULL,
  annual_revenue_cr  DECIMAL(10,1),
  lead_source        VARCHAR(20) NOT NULL,
  lead_date          DATE NOT NULL,
  sales_id           VARCHAR(5) NOT NULL,
  status             VARCHAR(30) NOT NULL,      -- current stage
  max_stage_reached  VARCHAR(30) NOT NULL,      -- furthest stage ever reached (for the funnel)
  lost_at_stage      VARCHAR(30) NULL,
  lost_reason        VARCHAR(60) NULL,
  decision_maker     BOOLEAN NOT NULL DEFAULT FALSE,
  interested         BOOLEAN NOT NULL DEFAULT FALSE,
  valid_contact      BOOLEAN NOT NULL DEFAULT FALSE,
  lead_score         TINYINT NOT NULL,
  lead_category      VARCHAR(5) NOT NULL,       -- Hot / Warm / Cold
  FOREIGN KEY (sales_id) REFERENCES Sales_Representatives(sales_id),
  FOREIGN KEY (status) REFERENCES Pipeline_Stages(stage),
  FOREIGN KEY (max_stage_reached) REFERENCES Pipeline_Stages(stage)
);

CREATE TABLE Contacts (
  contact_id    VARCHAR(6) PRIMARY KEY,
  lead_id       VARCHAR(6) NOT NULL,
  contact_name  VARCHAR(60) NOT NULL,
  email         VARCHAR(120),
  phone         VARCHAR(15),
  designation   VARCHAR(40),
  valid_email   BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (lead_id) REFERENCES Leads(lead_id)
);

CREATE TABLE Activities (
  activity_id    VARCHAR(7) PRIMARY KEY,
  lead_id        VARCHAR(6) NOT NULL,
  sales_id       VARCHAR(5) NOT NULL,
  activity_date  DATE NOT NULL,
  activity_type  VARCHAR(30) NOT NULL,          -- Email, Call, Meeting, Proposal ...
  outcome        VARCHAR(30),
  cadence_step   TINYINT NULL,                  -- 1-5 = Day 1/3/7/10/14 outreach step
  notes          VARCHAR(255),
  next_followup  DATE NULL,
  FOREIGN KEY (lead_id) REFERENCES Leads(lead_id),
  FOREIGN KEY (sales_id) REFERENCES Sales_Representatives(sales_id)
);

CREATE TABLE Opportunities (
  opportunity_id       VARCHAR(6) PRIMARY KEY,
  lead_id              VARCHAR(6) NOT NULL,
  stage                VARCHAR(30) NOT NULL,
  deal_value           DECIMAL(12,2) NOT NULL,
  probability          TINYINT NOT NULL,        -- 0-100, not a fraction
  created_date         DATE NOT NULL,
  expected_close_date  DATE,
  close_date           DATE NULL,
  lost_reason          VARCHAR(60) NULL,
  FOREIGN KEY (lead_id) REFERENCES Leads(lead_id),
  FOREIGN KEY (stage) REFERENCES Pipeline_Stages(stage)
);

CREATE INDEX idx_leads_status   ON Leads(status);
CREATE INDEX idx_act_lead_date  ON Activities(lead_id, activity_date);
CREATE INDEX idx_opp_stage      ON Opportunities(stage);
