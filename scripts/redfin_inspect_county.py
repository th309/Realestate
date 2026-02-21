import csv

fp = r'C:\Users\troyh\AppData\Local\Temp\redfin_county_full.tsv'

targets = {
    'Maricopa County, AZ': '04013',
    'Cook County, IL': '17031',
    'Los Angeles County, CA': '06037',
    'Harris County, TX': '48201',
    'King County, WA': '53033',
    'Miami-Dade County, FL': '12086',
    'San Diego County, CA': '06073',
    'Orange County, CA': '06059',
}

seen = set()
print('=== COUNTY TABLE_ID vs Known FIPS Codes ===')
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
        for name, fips in targets.items():
            if region == name:
                seen.add(region)
                match_str = 'MATCH' if fips == tid else f'MISMATCH (expected FIPS {fips})'
                print(f'  TABLE_ID={tid:>6} | REGION={region:<35} | {match_str}')
                break

# Count total unique counties and show TABLE_ID range
all_tids = set()
with open(fp, 'r', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter='\t')
    header = next(reader)
    for row in reader:
        if row[11] == 'All Residential':
            all_tids.add(int(row[5]))

print(f'\nTotal unique county TABLE_IDs: {len(all_tids)}')
print(f'TABLE_ID range: {min(all_tids)} to {max(all_tids)}')
print(f'(US has ~3,143 counties; FIPS range is 01001-56045)')
