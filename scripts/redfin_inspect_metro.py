import csv
import sys

fp = r'C:\Users\troyh\AppData\Local\Temp\redfin_metro_full.tsv'
targets = ['Phoenix', 'New York', 'Los Angeles', 'Chicago', 'Houston', 'Dallas', 'Miami', 'Atlanta', 'Boston', 'Denver', 'San Francisco', 'Seattle', 'Tampa']

known_cbsa = {
    'Phoenix': 38060,
    'New York': 35620,
    'Los Angeles': 31080,
    'Chicago': 16980,
    'Houston': 26420,
    'Dallas': 19100,
    'Miami': 33100,
    'Atlanta': 12060,
    'Boston': 14460,
    'Denver': 19740,
    'San Francisco': 41860,
    'Seattle': 42660,
    'Tampa': 45300,
}

seen = set()
print('=== METRO TABLE_ID vs Known CBSA Codes ===')
with open(fp, 'r', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    header = next(reader)
    for row in reader:
        prop_type = row[11]
        if prop_type != 'All Residential':
            continue
        region = row[7]
        tid = row[5]
        if region in seen:
            continue
        for t in targets:
            if region.startswith(t):
                seen.add(region)
                known = known_cbsa.get(t, '?')
                match_str = 'MATCH' if str(known) == tid else f'MISMATCH (expected {known})'
                print(f'  TABLE_ID={tid:>6} | REGION={region:<50} | {match_str}')
                break

print(f'\nTotal metros checked: {len(seen)}')
