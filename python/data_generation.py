"""
Step 1 - Generate a realistic, SYNTHETIC B2B sales dataset for an HR-software company.

Scenario : "PeopleFirst HR" sells HR Management Software to Indian businesses.
Output   : dataset/raw/*.csv  (deliberately a little messy, so data_cleaning.py has work to do)
Run      : python data_generation.py

All companies, people, emails and phone numbers are fictional. Emails use the reserved
example.com domain, so nothing here points at a real person or business.
Only the Python standard library + pandas are needed.
"""
import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

SEED = 2026
REPORT_DATE = date(2026, 11, 23)          # "today" for the snapshot
START_DATE = date(2026, 4, 1)
N_LEADS = 500
random.seed(SEED)

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "dataset" / "raw"
RAW.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- reference data
REPS = [  # sales_id, name, region, city, skill (close ability), diligence (follow-up habit)
    ("S01", "Rahul Verma",    "North", "Delhi",     0.85, 0.45),
    ("S02", "Priya Nair",     "South", "Bangalore", 1.05, 0.75),
    ("S03", "Amit Shah",      "West",  "Mumbai",    1.00, 0.65),
    ("S04", "Sneha Kulkarni", "West",  "Pune",      1.30, 0.90),
    ("S05", "Arjun Reddy",    "South", "Hyderabad", 0.95, 0.60),
    ("S06", "Kavya Iyer",     "South", "Chennai",   1.00, 0.70),
]
CITY_REP = {r[3]: r for r in REPS}
CITIES = {"Bangalore": 26, "Delhi": 20, "Mumbai": 18, "Hyderabad": 14, "Pune": 12, "Chennai": 10}

INDUSTRIES = {  # weight, conversion factor, speed factor (lower = faster), typical size
    "IT":            (26, 1.15, 0.80, 170),
    "Startup":       (16, 1.00, 0.85, 45),
    "Finance":       (14, 1.05, 1.10, 240),
    "Manufacturing": (14, 0.95, 1.30, 230),
    "E-commerce":    (12, 1.00, 0.90, 140),
    "Healthcare":    (10, 0.70, 1.20, 200),   # outside target industries
    "Education":     (8,  0.65, 1.20, 110),   # outside target industries
}
SOURCES = {  # weight, quality factor
    "LinkedIn": (30, 1.00), "Cold Email": (22, 0.75), "Website": (18, 1.15),
    "IndiaMART": (10, 0.80), "Events": (10, 1.10), "Referral": (10, 1.70),
}
DM_TITLES = ["CEO", "Founder", "CHRO", "HR Head", "HR Director", "HR Manager"]
OTHER_TITLES = ["Talent Acquisition Lead", "Admin Manager", "Operations Manager", "Finance Manager", "Office Manager"]
FIRST = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna", "Ishaan", "Rohan", "Kabir", "Ananya",
         "Diya", "Aadhya", "Saanvi", "Pari", "Myra", "Anika", "Navya", "Kiara", "Meera", "Riya", "Neha", "Pooja", "Karan",
         "Siddharth", "Nikhil", "Varun", "Tanvi", "Shreya", "Ishita", "Harsh", "Manav", "Devika", "Lakshmi", "Farhan",
         "Zoya", "Imran", "Gurpreet", "Simran", "Rahul", "Deepak", "Suresh", "Kavitha", "Lavanya", "Naveen", "Prakash"]
LAST = ["Sharma", "Verma", "Gupta", "Iyer", "Nair", "Reddy", "Rao", "Patel", "Shah", "Mehta", "Kulkarni", "Joshi",
        "Desai", "Menon", "Pillai", "Banerjee", "Chatterjee", "Das", "Singh", "Kaur", "Malhotra", "Kapoor", "Bose",
        "Mishra", "Pandey", "Agarwal", "Jain", "Khan", "Qureshi", "Fernandes", "D'Souza", "Naidu", "Hegde", "Shetty"]
PREFIX = ["Apex", "Nova", "Zenith", "Vertex", "Bright", "Blue", "Quantum", "Pixel", "Lotus", "Indus", "Saffron", "Orbit",
          "Peak", "Silver", "Crest", "Prime", "Urban", "Green", "Fusion", "Nexa", "Vista", "Core", "Spark", "Tru", "Aero",
          "Delta", "Kite", "Monsoon", "Ganga", "Coral", "Swift", "Bharat", "Sapphire", "Cedar", "Maple", "Echo", "Arc"]
SUFFIX = {
    "IT": ["Technologies", "Infotech", "Software", "Systems", "Digital", "Labs"],
    "Startup": ["Labs", "Ventures", "Works", "Hub", "AI", "Studio"],
    "Finance": ["Finance", "Capital", "Fintech", "Securities", "Wealth", "Credit"],
    "Manufacturing": ["Industries", "Manufacturing", "Engineering", "Polymers", "Steel", "Auto Parts"],
    "E-commerce": ["Retail", "Mart", "Commerce", "Bazaar", "Kart", "Store"],
    "Healthcare": ["Healthcare", "Hospitals", "Diagnostics", "Pharma", "Clinics", "Life Sciences"],
    "Education": ["Academy", "Learning", "Edutech", "Institute", "Schools", "Education"],
}
STAGES = ["New Lead", "Contacted", "Qualified", "Meeting Scheduled", "Proposal Sent", "Negotiation", "Won", "Lost"]
PROB = {"Qualified": 20, "Meeting Scheduled": 35, "Proposal Sent": 50, "Negotiation": 75, "Won": 100, "Lost": 0}
LOST_REASONS = {  # keyed by the stage index the lead was in when it was lost
    1: ["No response", "Not interested", "No response"],
    2: ["No budget", "Not interested", "Bad timing", "Using in-house tool"],
    3: ["No budget", "Went with competitor", "Bad timing"],
    4: ["Price too high", "Went with competitor", "No budget"],
    5: ["Price too high", "Went with competitor", "Bad timing"],
}


def pick(d):
    keys = list(d)
    return random.choices(keys, weights=[v[0] if isinstance(v, tuple) else v for v in d.values()])[0]


def rand_date():
    # more leads in later months (growing marketing effort)
    span = (REPORT_DATE - timedelta(days=2) - START_DATE).days
    x = random.random() ** 0.65
    return START_DATE + timedelta(days=int(x * span))


def slug(s):
    return "".join(ch for ch in s.lower() if ch.isalnum())


# ---------------------------------------------------------------- build tables
leads, contacts, activities, opps = [], [], [], []
used_names = set()
act_id = 1


def add_activity(lead_id, sales_id, d, typ, outcome, notes, step=None):
    global act_id
    activities.append(dict(activity_id=f"A{act_id:05d}", lead_id=lead_id, sales_id=sales_id, activity_date=d,
                           activity_type=typ, outcome=outcome, cadence_step=step, notes=notes, next_followup=None))
    act_id += 1


for i in range(1, N_LEADS + 1):
    lead_id = f"L{i:04d}"
    industry = pick(INDUSTRIES)
    _, ind_q, speed, typical = INDUSTRIES[industry]
    while True:
        name = f"{random.choice(PREFIX)} {random.choice(SUFFIX[industry])}"
        if name not in used_names:
            used_names.add(name)
            break
    city = pick(CITIES)
    rep = CITY_REP[city]
    if random.random() < 0.12:                     # some leads routed outside home city
        rep = random.choice(REPS)
    sales_id, _, _, _, skill, diligence = rep
    employees = max(8, int(random.lognormvariate(0, 0.7) * typical))
    revenue_cr = round(employees * random.uniform(0.03, 0.12), 1)   # annual revenue, Rs crore
    source = pick(SOURCES)
    src_q = SOURCES[source][1]
    lead_date = rand_date()

    # contacts: 1-2 per lead, decision maker identified ~65% of the time
    has_dm = random.random() < 0.65
    n_contacts = 2 if random.random() < 0.35 else 1
    for c in range(n_contacts):
        title = random.choice(DM_TITLES) if (c == 0 and has_dm) else random.choice(OTHER_TITLES)
        fn, ln = random.choice(FIRST), random.choice(LAST)
        contacts.append(dict(contact_id=f"C{len(contacts) + 1:04d}", lead_id=lead_id, contact_name=f"{fn} {ln}",
                             email=f"{slug(fn)}.{slug(ln)}@{slug(name)}.example.com",
                             phone="+91 9" + "".join(random.choice("0123456789") for _ in range(9)),
                             designation=title))

    # ---- simulate the journey through the pipeline
    mult = src_q * ind_q * skill * (1.10 if employees > 200 else 0.95) * (1.15 if has_dm else 0.85)
    m = mult ** 0.6
    stage_idx, d = 0, lead_date                  # 0 = New Lead
    status, lost_at, lost_reason, close_date = "New Lead", None, None, None
    max_stage = 0
    qualified_date = None
    reply_step = random.choices([1, 2, 3, 4], weights=[35, 30, 20, 15])[0]

    # New -> Contacted
    if random.random() < 0.90:
        nd = d + timedelta(days=random.randint(0, 4))
        if nd <= REPORT_DATE:
            stage_idx, d, status, max_stage = 1, nd, "Contacted", 1
    if stage_idx == 1:
        # outreach cadence: Day 1, 3, 7, 10, 14
        advance = random.random() < min(0.92, 0.42 * m)
        steps = reply_step if advance else random.choice([4, 5])
        offsets = [0, 2, 6, 9, 13]
        for s in range(steps):
            sd = d + timedelta(days=offsets[s])
            if sd > REPORT_DATE:
                advance = None                   # cadence still running
                break
            replied = advance and s == steps - 1
            add_activity(lead_id, sales_id, sd, "Call" if s == 3 else "Email",
                         "Replied" if replied else "No Response",
                         ["Intro email", "Follow-up 1", "Follow-up 2", "Call attempt", "Break-up email"][s], step=s + 1)
            last_cadence = sd
        if advance is False:
            if (last_cadence + timedelta(days=3)) <= REPORT_DATE:
                status, lost_at, lost_reason, close_date = "Lost", 1, random.choice(LOST_REASONS[1]), last_cadence + timedelta(days=3)
        elif advance:
            d = last_cadence + timedelta(days=random.randint(1, 3))
            if d <= REPORT_DATE:
                stage_idx, status, max_stage, qualified_date = 2, "Qualified", 2, d
                add_activity(lead_id, sales_id, d, "Discovery Call", "Qualified", "Need, budget and decision-maker confirmed")

    # Qualified -> Meeting -> Proposal -> Negotiation -> Won
    plan = [(0.70, "Meeting Scheduled", "Meeting", "Meeting Booked", "Product demo booked", (4, 12)),
            (0.66, "Proposal Sent", "Proposal", "Proposal Shared", "Pricing proposal shared", (5, 14)),
            (0.62, "Negotiation", "Negotiation Call", "Negotiating", "Discussing price and terms", (5, 15)),
            (0.64, "Won", "Closing Call", "Closed Won", "Contract signed", (4, 14))]
    while status not in ("Won", "Lost") and 2 <= stage_idx <= 5:
        p, nxt, typ, outcome, note, (lo, hi) = plan[stage_idx - 2]
        nd = d + timedelta(days=int(random.randint(lo, hi) * speed * 1.7))
        if nd > REPORT_DATE:
            break                                # still open in current stage
        if random.random() < min(0.95, p * m):
            stage_idx += 1
            d = nd
            if nxt == "Won":
                status, close_date = "Won", d
                add_activity(lead_id, sales_id, d, typ, outcome, note)
            else:
                status, max_stage = nxt, stage_idx
                add_activity(lead_id, sales_id, d, typ, outcome, note)
        else:
            status, lost_at = "Lost", stage_idx
            lost_reason, close_date = random.choice(LOST_REASONS[stage_idx]), nd
            add_activity(lead_id, sales_id, nd, "Call", "Closed Lost", f"Lost: {lost_reason}")
    if status == "Won":
        max_stage = 6

    # follow-up habit for open leads: periodic touches after the last stage change
    if status not in ("Won", "Lost") and stage_idx >= 1:
        lead_acts = [a for a in activities if a["lead_id"] == lead_id]
        last = max(a["activity_date"] for a in lead_acts) if lead_acts else d
        t = last
        while True:
            t = t + timedelta(days=random.randint(5, 9))
            if t > REPORT_DATE - timedelta(days=1) or random.random() > diligence * 0.85:
                break
            add_activity(lead_id, sales_id, t, random.choice(["Call", "Email", "WhatsApp"]), "Follow-up done", "Checked in on next steps")
        lead_acts = [a for a in activities if a["lead_id"] == lead_id]
        if lead_acts:
            last_act = max(lead_acts, key=lambda a: (a["activity_date"], a["activity_id"]))
            last_act["next_followup"] = last_act["activity_date"] + timedelta(days=random.randint(2, 10))

    leads.append(dict(lead_id=lead_id, company_name=name, industry=industry, location=city, employees=employees,
                      annual_revenue_cr=revenue_cr, lead_source=source, lead_date=lead_date, sales_id=sales_id,
                      status=status, max_stage_reached=STAGES[max_stage], lost_at_stage=STAGES[lost_at] if lost_at else None,
                      lost_reason=lost_reason))

    if qualified_date:
        per_emp = random.choice([1800, 2100, 2400, 2700])
        value = max(60000, round(employees * per_emp / 5000) * 5000)
        stage = status if status in PROB else "Qualified"
        opps.append(dict(opportunity_id=f"O{len(opps) + 1:04d}", lead_id=lead_id, stage=stage, deal_value=value,
                         probability=PROB[stage], created_date=qualified_date,
                         expected_close_date=qualified_date + timedelta(days=int(45 * speed)),
                         close_date=close_date if status in ("Won", "Lost") else None,
                         lost_reason=lost_reason if status == "Lost" else None))

leads_df, contacts_df = pd.DataFrame(leads), pd.DataFrame(contacts)
acts_df, opps_df = pd.DataFrame(activities), pd.DataFrame(opps)
reps_df = pd.DataFrame([dict(sales_id=r[0], sales_name=r[1], region=r[2], base_city=r[3]) for r in REPS])

# ---------------------------------------------------------------- make the raw data messy (realistic)
def messy_case(v):
    return random.choice([v.lower(), v.upper(), f" {v} ", f"{v}  "])

for col, rate in (("location", 0.08), ("industry", 0.06)):
    idx = leads_df.sample(frac=rate, random_state=random.randint(0, 9999)).index
    leads_df.loc[idx, col] = leads_df.loc[idx, col].map(messy_case)
alias = {"Bangalore": "Bengaluru", "Delhi": "New Delhi", "Mumbai": "Bombay"}
idx = leads_df[leads_df.location.isin(alias)].sample(frac=0.06, random_state=7).index
leads_df.loc[idx, "location"] = leads_df.loc[idx, "location"].map(alias)
src_typos = {"LinkedIn": ["linkedin", "Linked In"], "Cold Email": ["cold email", "Cold-Email"], "Referral": ["Referal", "referral"]}
idx = leads_df[leads_df.lead_source.isin(src_typos)].sample(frac=0.10, random_state=11).index
leads_df.loc[idx, "lead_source"] = leads_df.loc[idx, "lead_source"].map(lambda s: random.choice(src_typos[s]))
idx = leads_df.sample(frac=0.02, random_state=13).index
leads_df["employees"] = leads_df["employees"].astype("object")
leads_df.loc[idx, "employees"] = None                                   # missing values
leads_df["lead_date"] = leads_df["lead_date"].astype("object")
idx = leads_df.sample(frac=0.05, random_state=17).index                # mixed date formats
leads_df.loc[idx, "lead_date"] = leads_df.loc[idx, "lead_date"].map(lambda d: d.strftime("%d/%m/%Y"))
dupes = leads_df.sample(n=12, random_state=19).copy()                   # duplicate leads entered twice
dupes["company_name"] = dupes["company_name"].map(lambda s: random.choice([s.upper(), s + " ", s.lower()]))
dupes["lead_id"] = [f"L{N_LEADS + k + 1:04d}" for k in range(len(dupes))]
dupes["status"], dupes["max_stage_reached"], dupes["lost_at_stage"], dupes["lost_reason"] = "New Lead", "New Lead", None, None
leads_df = pd.concat([leads_df, dupes], ignore_index=True)

def messy_phone(p):
    digits = p.replace("+91 ", "")
    return random.choice([p, "0" + digits, digits[:5] + "-" + digits[5:], digits, "+91-" + digits])
contacts_df["phone"] = contacts_df["phone"].map(lambda p: messy_phone(p) if random.random() < 0.35 else p)
idx = contacts_df.sample(frac=0.02, random_state=23).index
contacts_df.loc[idx, "phone"] = contacts_df.loc[idx, "phone"].map(lambda p: p[:7])        # invalid (too short)
idx = contacts_df.sample(frac=0.03, random_state=29).index
contacts_df.loc[idx, "email"] = contacts_df.loc[idx, "email"].map(lambda e: e.replace("@", "", 1))   # invalid
idx = contacts_df.sample(frac=0.05, random_state=31).index
contacts_df.loc[idx, "email"] = contacts_df.loc[idx, "email"].str.upper()

leads_df.to_csv(RAW / "leads_raw.csv", index=False)
contacts_df.to_csv(RAW / "contacts_raw.csv", index=False)
acts_df.to_csv(RAW / "activities_raw.csv", index=False)
opps_df.to_csv(RAW / "opportunities_raw.csv", index=False)
reps_df.to_csv(RAW / "sales_reps_raw.csv", index=False)

print(f"Generated {len(leads_df)} lead rows (incl. {len(dupes)} duplicates), {len(contacts_df)} contacts, "
      f"{len(acts_df)} activities, {len(opps_df)} opportunities -> {RAW}")
