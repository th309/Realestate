"""
Create and populate the census_division_mapping table in Supabase.
Maps 50 states + DC to their Census Bureau division (9 divisions).
"""

import os
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

DIVISIONS = {
    1: ("New England",        ["CT", "ME", "MA", "NH", "RI", "VT"]),
    2: ("Middle Atlantic",    ["NJ", "NY", "PA"]),
    3: ("East North Central", ["IL", "IN", "MI", "OH", "WI"]),
    4: ("West North Central", ["IA", "KS", "MN", "MO", "NE", "ND", "SD"]),
    5: ("South Atlantic",     ["DE", "DC", "FL", "GA", "MD", "NC", "SC", "VA", "WV"]),
    6: ("East South Central", ["AL", "KY", "MS", "TN"]),
    7: ("West South Central", ["AR", "LA", "OK", "TX"]),
    8: ("Mountain",           ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY"]),
    9: ("Pacific",            ["AK", "CA", "HI", "OR", "WA"]),
}

def main():
    client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Build rows
    rows = []
    for div_id, (div_name, states) in DIVISIONS.items():
        for state_code in states:
            rows.append({
                "state_code": state_code,
                "division_id": div_id,
                "division_name": div_name,
            })

    print(f"Inserting {len(rows)} state-to-division mappings...")

    # Upsert all rows
    result = client.table("census_division_mapping").upsert(rows).execute()
    print(f"Done. Rows upserted: {len(result.data)}")

if __name__ == "__main__":
    main()
