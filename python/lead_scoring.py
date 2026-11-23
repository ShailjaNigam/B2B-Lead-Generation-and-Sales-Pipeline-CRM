"""
Step 3 - Score and classify every lead (0-100 -> Hot / Warm / Cold).

Reads   : dataset/leads.csv, contacts.csv, activities.csv
Writes  : dataset/leads.csv (adds score columns)
Run     : python lead_scoring.py

Scoring rules (illustrative - a real company would calibrate them on historical conversions):
  +25  company has more than 200 employees
  +20  company is in a target industry
  +20  a decision-maker contact is identified
  +25  the lead has shown interest (replied / booked a meeting / qualified)
  +10  valid business contact information (valid email AND valid phone)

Note: "shown interest" is measured from activities, so Hot leads converting more is partly built in.
Mention this when you present the analysis.
"""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1] / "dataset"
TARGET_INDUSTRIES = ["IT", "Startup", "Finance", "Manufacturing", "E-commerce"]
DECISION_MAKERS = ["CEO", "Founder", "CHRO", "HR Head", "HR Director", "HR Manager"]
INTEREST_OUTCOMES = ["Replied", "Qualified", "Meeting Booked", "Proposal Shared", "Negotiating", "Closed Won"]


def calculate_lead_score(lead):
    """Same logic as the brief, written as a plain function (used by the Flask backend too)."""
    score = 0
    if lead["employees"] > 200:
        score += 25
    if lead["industry"] in TARGET_INDUSTRIES:
        score += 20
    if lead["decision_maker"]:
        score += 20
    if lead["interested"]:
        score += 25
    if lead["valid_contact"]:
        score += 10
    return score


def classify_lead(score):
    if score >= 75:
        return "Hot"
    elif score >= 40:
        return "Warm"
    return "Cold"


def main():
    leads = pd.read_csv(ROOT / "leads.csv")
    contacts = pd.read_csv(ROOT / "contacts.csv", dtype={"phone": str})
    acts = pd.read_csv(ROOT / "activities.csv")

    dm = set(contacts.loc[contacts["designation"].isin(DECISION_MAKERS), "lead_id"])
    valid = set(contacts.loc[contacts["valid_email"].astype(bool) & contacts["phone"].notna(), "lead_id"])
    interested = set(acts.loc[acts["outcome"].isin(INTEREST_OUTCOMES), "lead_id"])

    leads["decision_maker"] = leads["lead_id"].isin(dm)
    leads["interested"] = leads["lead_id"].isin(interested)
    leads["valid_contact"] = leads["lead_id"].isin(valid)
    leads["lead_score"] = leads.apply(calculate_lead_score, axis=1)
    leads["lead_category"] = leads["lead_score"].map(classify_lead)
    leads.to_csv(ROOT / "leads.csv", index=False)

    print(leads["lead_category"].value_counts().to_string())
    won = leads["status"].eq("Won")
    print("\nConversion rate by category:")
    print((won.groupby(leads["lead_category"]).mean() * 100).round(1).astype(str).add("%").to_string())


if __name__ == "__main__":
    main()
