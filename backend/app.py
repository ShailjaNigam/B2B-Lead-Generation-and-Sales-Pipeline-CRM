"""
PeopleFirst CRM - Flask backend (REST API + serves the frontend).

Deploy (Render.com): build "pip install -r requirements.txt", start "gunicorn --chdir backend app:app".

Quick start (SQLite, zero setup):
    pip install flask pandas
    python backend/app.py            ->  open http://127.0.0.1:5000

Use MySQL instead (after running sql/create_tables.sql and sql/insert_data.sql):
    pip install pymysql
    set DB_URL=mysql://user:password@localhost:3306/B2B_Sales_DB     (Windows)
    export DB_URL=mysql://user:password@localhost:3306/B2B_Sales_DB  (Mac/Linux)
    python backend/app.py

Flow for "Add lead": frontend form -> POST /api/leads -> validate -> insert lead + contact
-> Python lead_scoring.calculate_lead_score() -> stored -> dashboard refreshes.
"""
import os
import re
import sqlite3
import sys
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
from flask import Flask, abort, jsonify, request, send_from_directory

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
DATASET = ROOT / "dataset"
SQLITE_PATH = Path(__file__).resolve().parent / "crm.db"
sys.path.insert(0, str(ROOT / "python"))
from lead_scoring import (DECISION_MAKERS, INTEREST_OUTCOMES, TARGET_INDUSTRIES,  # noqa: E402
                          calculate_lead_score, classify_lead)

DB_URL = os.environ.get("DB_URL", "")
IS_MYSQL = DB_URL.startswith("mysql")
STAGES = ["New Lead", "Contacted", "Qualified", "Meeting Scheduled", "Proposal Sent", "Negotiation", "Won", "Lost"]
EMAIL_RE = re.compile(r"^[\w.+-]+@[\w-]+(\.[\w-]+)+$")
LEAD_COLS = ["lead_id", "company_name", "industry", "location", "employees", "annual_revenue_cr", "lead_source", "lead_date", "sales_id",
             "status", "max_stage_reached", "lost_at_stage", "lost_reason", "decision_maker", "interested", "valid_contact", "lead_score", "lead_category"]
CONTACT_COLS = ["contact_id", "lead_id", "contact_name", "email", "phone", "designation", "valid_email"]
ACT_COLS = ["activity_id", "lead_id", "sales_id", "activity_date", "activity_type", "outcome", "cadence_step", "notes", "next_followup"]
OPP_COLS = ["opportunity_id", "lead_id", "stage", "deal_value", "probability", "created_date", "expected_close_date", "close_date", "lost_reason"]
BOOLS = {"decision_maker", "interested", "valid_contact", "valid_email"}

app = Flask(__name__)


# ---------------------------------------------------------------- database helpers
def connect():
    if IS_MYSQL:
        import pymysql  # only needed for MySQL mode
        u = urlparse(DB_URL)
        return pymysql.connect(host=u.hostname, port=u.port or 3306, user=u.username, password=u.password or "",
                               database=u.path.lstrip("/"), cursorclass=pymysql.cursors.DictCursor, autocommit=True)
    con = sqlite3.connect(SQLITE_PATH)
    con.row_factory = sqlite3.Row
    return con


def run(sql, params=(), fetch=True):
    """Execute SQL written with ? placeholders on either SQLite or MySQL."""
    if IS_MYSQL:
        sql = sql.replace("?", "%s")
    con = connect()
    try:
        cur = con.cursor()
        cur.execute(sql, params)
        rows = [dict(r) for r in cur.fetchall()] if fetch else None
        if not IS_MYSQL:
            con.commit()
        return rows
    finally:
        con.close()


def clean_row(r):
    out = {}
    for k, v in r.items():
        if k in BOOLS and v is not None:
            v = bool(v)
        elif hasattr(v, "isoformat"):
            v = v.isoformat()[:10]
        elif hasattr(v, "is_integer"):  # Decimal / float from MySQL
            v = int(v) if float(v).is_integer() else float(v)
        out[k] = v
    return out


def init_sqlite():
    """Build backend/crm.db from the cleaned CSVs the first time the server starts."""
    if IS_MYSQL or SQLITE_PATH.exists():
        return
    con = sqlite3.connect(SQLITE_PATH)
    for name, table in (("sales_reps", "Sales_Representatives"), ("leads", "Leads"), ("contacts", "Contacts"),
                        ("activities", "Activities"), ("opportunities", "Opportunities")):
        df = pd.read_csv(DATASET / f"{name}.csv", dtype={"phone": str} if name == "contacts" else None)
        for b in BOOLS & set(df.columns):
            df[b] = df[b].astype(bool).astype(int)
        df.to_sql(table, con, index=False)
    pd.DataFrame({"stage": STAGES, "stage_order": [1, 2, 3, 4, 5, 6, 7, 0],
                  "default_probability": [5, 10, 20, 35, 50, 75, 100, 0]}).to_sql("Pipeline_Stages", con, index=False)
    con.commit()
    con.close()
    print(f"Created {SQLITE_PATH} from dataset/*.csv")


def rescore(lead_id):
    """Recalculate a lead's score with the same Python function used in the data pipeline."""
    found = run("SELECT * FROM Leads WHERE lead_id = ?", (lead_id,))
    if not found:  # e.g. an activity arrived a moment before its lead
        return None, None
    lead = found[0]
    contacts = run("SELECT designation, email, phone, valid_email FROM Contacts WHERE lead_id = ?", (lead_id,))
    acts = run("SELECT outcome FROM Activities WHERE lead_id = ?", (lead_id,))
    lead["decision_maker"] = any(c["designation"] in DECISION_MAKERS for c in contacts)
    lead["interested"] = any(a["outcome"] in INTEREST_OUTCOMES for a in acts)
    lead["valid_contact"] = any(c["valid_email"] and c["phone"] for c in contacts)
    score = calculate_lead_score({"employees": lead["employees"], "industry": lead["industry"], "decision_maker": lead["decision_maker"],
                                  "interested": lead["interested"], "valid_contact": lead["valid_contact"]})
    run("UPDATE Leads SET decision_maker = ?, interested = ?, valid_contact = ?, lead_score = ?, lead_category = ? WHERE lead_id = ?",
        (int(lead["decision_maker"]), int(lead["interested"]), int(lead["valid_contact"]), score, classify_lead(score), lead_id), fetch=False)
    return score, classify_lead(score)


# ---------------------------------------------------------------- frontend
@app.get("/")
def index():
    html = (FRONTEND / "index.html").read_text(encoding="utf-8")
    return html.replace("<!--API_CONFIG-->", '<script>window.CRM_API = "/api";</script>')


@app.get("/<path:path>")
def static_files(path):
    return send_from_directory(FRONTEND, path)


# ---------------------------------------------------------------- API
@app.get("/api/health")
def health():
    return {"ok": True, "database": "mysql" if IS_MYSQL else "sqlite"}


@app.get("/api/data")
def all_data():
    """Everything the single-page frontend needs, in the same shape as frontend/js/data.js."""
    return jsonify({
        "meta": {"company": "PeopleFirst HR", "snapshot_date": "2026-11-23", "note": "Served by Flask"},
        "reps": [clean_row(r) for r in run("SELECT * FROM Sales_Representatives ORDER BY sales_id")],
        "leads": [clean_row(r) for r in run("SELECT * FROM Leads ORDER BY lead_id")],
        "contacts": [clean_row(r) for r in run("SELECT * FROM Contacts ORDER BY contact_id")],
        "activities": [clean_row(r) for r in run("SELECT * FROM Activities ORDER BY activity_id")],
        "opportunities": [clean_row(r) for r in run("SELECT * FROM Opportunities ORDER BY opportunity_id")],
    })


@app.get("/api/leads")
def list_leads():
    """Search and filter: /api/leads?q=vista&industry=IT&status=Qualified&category=Hot&rep=S02"""
    sql, params = "SELECT * FROM Leads WHERE 1=1", []
    if q := request.args.get("q"):
        sql += " AND LOWER(company_name) LIKE ?"
        params.append(f"%{q.lower()}%")
    for arg, col in (("industry", "industry"), ("status", "status"), ("category", "lead_category"), ("rep", "sales_id"), ("source", "lead_source")):
        if v := request.args.get(arg):
            sql += f" AND {col} = ?"
            params.append(v)
    return jsonify([clean_row(r) for r in run(sql + " ORDER BY lead_score DESC, lead_id", tuple(params))])


@app.post("/api/leads")
def add_lead():
    body = request.get_json(force=True)
    lead, contact = body.get("lead", {}), body.get("contact", {})
    errors = []
    if not str(lead.get("company_name", "")).strip():
        errors.append("company_name is required")
    if lead.get("industry") not in TARGET_INDUSTRIES + ["Healthcare", "Education"]:
        errors.append("unknown industry")
    try:
        if int(lead.get("employees", 0)) <= 0:
            errors.append("employees must be positive")
    except (TypeError, ValueError):
        errors.append("employees must be a number")
    if contact.get("email") and not EMAIL_RE.match(contact["email"]):
        errors.append("invalid email")
    if errors:
        return {"errors": errors}, 400
    run(f"INSERT INTO Leads ({', '.join(LEAD_COLS)}) VALUES ({', '.join('?' * len(LEAD_COLS))})",
        tuple(int(lead[c]) if c in BOOLS else lead.get(c) for c in LEAD_COLS), fetch=False)
    if contact:
        contact["valid_email"] = bool(contact.get("email") and EMAIL_RE.match(contact["email"]))
        run(f"INSERT INTO Contacts ({', '.join(CONTACT_COLS)}) VALUES ({', '.join('?' * len(CONTACT_COLS))})",
            tuple(int(contact[c]) if c in BOOLS else contact.get(c) for c in CONTACT_COLS), fetch=False)
    score, cat = rescore(lead["lead_id"])
    return {"lead_id": lead["lead_id"], "lead_score": score, "lead_category": cat}, 201


@app.patch("/api/leads/<lead_id>")
def update_lead(lead_id):
    body = request.get_json(force=True)
    allowed = ["status", "max_stage_reached", "lost_at_stage", "lost_reason", "sales_id"]
    sets = [c for c in allowed if c in body]
    if "status" in body and body["status"] not in STAGES:
        return {"errors": ["unknown stage"]}, 400
    if not run("SELECT lead_id FROM Leads WHERE lead_id = ?", (lead_id,)):
        abort(404)
    if sets:
        run(f"UPDATE Leads SET {', '.join(c + ' = ?' for c in sets)} WHERE lead_id = ?", tuple(body[c] for c in sets) + (lead_id,), fetch=False)
    score, cat = rescore(lead_id)
    return {"lead_id": lead_id, "lead_score": score, "lead_category": cat}


@app.post("/api/activities")
def add_activity():
    a = request.get_json(force=True)
    if not a.get("lead_id") or not a.get("activity_type"):
        return {"errors": ["lead_id and activity_type are required"]}, 400
    run(f"INSERT INTO Activities ({', '.join(ACT_COLS)}) VALUES ({', '.join('?' * len(ACT_COLS))})", tuple(a.get(c) for c in ACT_COLS), fetch=False)
    rescore(a["lead_id"])
    return {"activity_id": a["activity_id"]}, 201


@app.put("/api/opportunities/<opp_id>")
def upsert_opportunity(opp_id):
    o = request.get_json(force=True)
    o["opportunity_id"] = opp_id
    if run("SELECT opportunity_id FROM Opportunities WHERE opportunity_id = ?", (opp_id,)):
        cols = [c for c in OPP_COLS if c != "opportunity_id"]
        run(f"UPDATE Opportunities SET {', '.join(c + ' = ?' for c in cols)} WHERE opportunity_id = ?", tuple(o.get(c) for c in cols) + (opp_id,), fetch=False)
    else:
        run(f"INSERT INTO Opportunities ({', '.join(OPP_COLS)}) VALUES ({', '.join('?' * len(OPP_COLS))})", tuple(o.get(c) for c in OPP_COLS), fetch=False)
    return {"opportunity_id": opp_id}


@app.get("/api/kpis")
def kpis():
    k = run("""SELECT COUNT(*) AS total_leads,
                      SUM(CASE WHEN status = 'Won' THEN 1 ELSE 0 END) AS customers,
                      SUM(CASE WHEN lead_category = 'Hot' THEN 1 ELSE 0 END) AS hot_leads
               FROM Leads""")[0]
    p = run("""SELECT SUM(deal_value) AS pipeline_value, SUM(deal_value * probability / 100.0) AS weighted_pipeline
               FROM Opportunities WHERE stage NOT IN ('Won', 'Lost')""")[0]
    k = clean_row({**k, **p})
    k["conversion_rate_pct"] = round(100 * k["customers"] / k["total_leads"], 1) if k["total_leads"] else 0
    return k


@app.get("/api/followups")
def followups():
    """Latest activity per open lead with its follow-up status (?today=YYYY-MM-DD, default = snapshot date)."""
    today = request.args.get("today", "2026-11-23")
    rows = run("""SELECT l.lead_id, l.company_name, l.status, a.activity_date AS last_contact, a.next_followup
                  FROM Leads l JOIN Activities a ON a.lead_id = l.lead_id
                  WHERE l.status NOT IN ('Won', 'Lost')
                    AND a.activity_id = (SELECT a2.activity_id FROM Activities a2 WHERE a2.lead_id = l.lead_id
                                         ORDER BY a2.activity_date DESC, a2.activity_id DESC LIMIT 1)
                  ORDER BY a.next_followup""")
    for r in rows:
        nf = str(r["next_followup"])[:10] if r["next_followup"] else None
        r["followup_status"] = "No follow-up set" if not nf else "Overdue" if nf < today else "Due today" if nf == today else "Upcoming"
    return jsonify([clean_row(r) for r in rows])


# Build the SQLite database on import too, so hosting with gunicorn (e.g. Render) works.
init_sqlite()

if __name__ == "__main__":
    print("PeopleFirst CRM running on http://127.0.0.1:5000  (database:", "MySQL" if IS_MYSQL else "SQLite", ")")
    app.run(debug=False, port=int(os.environ.get("PORT", 5000)))
