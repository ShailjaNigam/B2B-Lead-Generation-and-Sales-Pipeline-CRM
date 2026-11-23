"""
Step 2 - Clean the raw CRM data.

Reads   : dataset/raw/*_raw.csv
Writes  : dataset/leads.csv, contacts.csv, activities.csv, opportunities.csv, sales_reps.csv
          dataset/cleaning_log.txt  (what was fixed and how many rows)
Run     : python data_cleaning.py
"""
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW, OUT = ROOT / "dataset" / "raw", ROOT / "dataset"
log = []


def note(msg):
    log.append(msg)
    print(" -", msg)


leads = pd.read_csv(RAW / "leads_raw.csv", dtype=str)
contacts = pd.read_csv(RAW / "contacts_raw.csv", dtype=str)
acts = pd.read_csv(RAW / "activities_raw.csv", dtype=str)
opps = pd.read_csv(RAW / "opportunities_raw.csv", dtype=str)
reps = pd.read_csv(RAW / "sales_reps_raw.csv", dtype=str)
note(f"Loaded {len(leads)} leads, {len(contacts)} contacts, {len(acts)} activities, {len(opps)} opportunities, {len(reps)} reps")

# 1. Trim whitespace in every text column
for df in (leads, contacts, acts, opps, reps):
    for c in df.columns:
        df[c] = df[c].str.strip()

# 2. Standardise categories (case, aliases, typos)
CITY_ALIAS = {"bengaluru": "Bangalore", "new delhi": "Delhi", "bombay": "Mumbai"}
before = leads["location"].copy()
leads["location"] = leads["location"].str.lower().map(lambda v: CITY_ALIAS.get(v, v)).str.title()
note(f"Standardised location for {(before != leads['location']).sum()} rows (case, spaces, Bengaluru/New Delhi/Bombay aliases)")

IND = {"it": "IT", "e-commerce": "E-commerce"}
before = leads["industry"].copy()
leads["industry"] = leads["industry"].str.lower().map(lambda v: IND.get(v, v.title()))
note(f"Standardised industry for {(before != leads['industry']).sum()} rows")

SRC = {"linkedin": "LinkedIn", "linked in": "LinkedIn", "cold email": "Cold Email", "cold-email": "Cold Email",
       "referal": "Referral", "referral": "Referral", "website": "Website", "indiamart": "IndiaMART", "events": "Events"}
before = leads["lead_source"].copy()
leads["lead_source"] = leads["lead_source"].str.lower().map(SRC)
note(f"Fixed lead_source spelling/case for {(before != leads['lead_source']).sum()} rows")

# 3. Parse mixed date formats (ISO yyyy-mm-dd and dd/mm/yyyy)
def parse_date(v):
    if pd.isna(v) or v == "":
        return pd.NaT
    if re.fullmatch(r"\d{2}/\d{2}/\d{4}", v):
        return pd.to_datetime(v, format="%d/%m/%Y")
    return pd.to_datetime(v, format="%Y-%m-%d")

n_mixed = leads["lead_date"].str.contains("/", na=False).sum()
leads["lead_date"] = leads["lead_date"].map(parse_date)
note(f"Converted {n_mixed} dd/mm/yyyy lead dates to ISO format")

# 4. Remove duplicate leads (same company + city, case-insensitive) - keep the earliest lead_id
leads["_key"] = leads["company_name"].str.lower().str.strip() + "|" + leads["location"]
dupes = leads[leads.duplicated("_key", keep="first")]
leads = leads.drop_duplicates("_key", keep="first").drop(columns="_key")
note(f"Removed {len(dupes)} duplicate leads ({', '.join(dupes['lead_id'].head(5))}, ...)")

# 5. Fill missing employee counts with the industry median
leads["employees"] = pd.to_numeric(leads["employees"], errors="coerce")
missing = leads["employees"].isna().sum()
leads["employees"] = leads["employees"].fillna(leads.groupby("industry")["employees"].transform("median")).round().astype(int)
note(f"Imputed {missing} missing employee counts with the industry median")
leads["annual_revenue_cr"] = pd.to_numeric(leads["annual_revenue_cr"], errors="coerce")

# 6. Contacts: normalise phone numbers to +91XXXXXXXXXX, lower-case emails, flag invalid values
def clean_phone(p):
    digits = re.sub(r"\D", "", str(p))
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    return "+91" + digits if len(digits) == 10 else None

nonstandard = (~contacts["phone"].str.fullmatch(r"\+91 \d{10}", na=False)).sum()
contacts["phone"] = contacts["phone"].map(clean_phone)
note(f"Normalised all phones to +91XXXXXXXXXX ({nonstandard} were in non-standard formats); {contacts['phone'].isna().sum()} invalid phones set to blank")
contacts["email"] = contacts["email"].str.lower()
EMAIL_RE = r"^[\w.+-]+@[\w-]+(\.[\w-]+)+$"
contacts["valid_email"] = contacts["email"].str.match(EMAIL_RE, na=False)
note(f"Lower-cased emails; flagged {(~contacts['valid_email']).sum()} invalid emails (kept, marked valid_email = False)")
contacts = contacts[contacts["lead_id"].isin(leads["lead_id"])]

# 7. Type conversions for the child tables
for c in ("activity_date", "next_followup"):
    acts[c] = pd.to_datetime(acts[c], errors="coerce")
acts["cadence_step"] = pd.to_numeric(acts["cadence_step"], errors="coerce").astype("Int64")
for c in ("created_date", "expected_close_date", "close_date"):
    opps[c] = pd.to_datetime(opps[c], errors="coerce")
opps["deal_value"] = pd.to_numeric(opps["deal_value"]).astype(int)
opps["probability"] = pd.to_numeric(opps["probability"]).astype(int)   # stored as 0-100, never as a fraction

# 8. Referential integrity checks
assert acts["lead_id"].isin(leads["lead_id"]).all(), "activity points to unknown lead"
assert opps["lead_id"].isin(leads["lead_id"]).all(), "opportunity points to unknown lead"
assert leads["sales_id"].isin(reps["sales_id"]).all(), "lead assigned to unknown rep"
note("Referential integrity OK: every activity, opportunity and lead links to an existing parent row")

# 9. Save
fmt = "%Y-%m-%d"
leads.to_csv(OUT / "leads.csv", index=False, date_format=fmt)
contacts.to_csv(OUT / "contacts.csv", index=False)
acts.to_csv(OUT / "activities.csv", index=False, date_format=fmt)
opps.to_csv(OUT / "opportunities.csv", index=False, date_format=fmt)
reps.to_csv(OUT / "sales_reps.csv", index=False)
note(f"Saved clean files: {len(leads)} leads, {len(contacts)} contacts, {len(acts)} activities, {len(opps)} opportunities")
(OUT / "cleaning_log.txt").write_text("Data cleaning log\n=================\n" + "\n".join(f"- {m}" for m in log) + "\n")
