#!/usr/bin/env python3
"""Parse worldcup-2026-draft-board.xlsx -> data/draft-board.json.
Run when the Excel changes:  python3 scripts/parse-draft-board.py
The xlsx (Google-Sheets export) has a stylesheet openpyxl rejects, so we read XML directly."""
import zipfile, json, re, unicodedata
import xml.etree.ElementTree as ET

XLSX = 'worldcup-2026-draft-board.xlsx'
OUT  = 'data/draft-board.json'
NS   = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
Z = zipfile.ZipFile(XLSX)

def shared_strings():
    out=[]
    for si in ET.fromstring(Z.read('xl/sharedStrings.xml')).findall(f'{NS}si'):
        out.append(''.join(t.text or '' for t in si.iter(f'{NS}t')))
    return out
SS = shared_strings()

def col_letters(ref): return ''.join(c for c in ref if c.isalpha())
def cell_value(c):
    t=c.get('t'); v=c.find(f'{NS}v')
    if t=='s': return SS[int(v.text)] if v is not None else ''
    if t=='inlineStr':
        isn=c.find(f'{NS}is'); return ''.join(x.text or '' for x in isn.iter(f'{NS}t')) if isn is not None else ''
    return v.text if v is not None else ''

def sheet_rows(sid):
    root=ET.fromstring(Z.read(f'xl/worksheets/sheet{sid}.xml'))
    rows=[]
    for row in root.iter(f'{NS}row'):
        d={}
        for c in row.findall(f'{NS}c'):
            val=cell_value(c)
            if val not in (None,''): d[col_letters(c.get('r'))]=val
        rows.append(d)
    return rows

def norm(s):
    s=unicodedata.normalize('NFKD', s)
    s=''.join(ch for ch in s if not unicodedata.combining(ch))
    return re.sub(r'[^a-z0-9]','', s.lower())

# ---- flags from Tier Board (sheet1): leading emoji before name ----
flag_by_name={}
EMOJI_RE=re.compile(r'^([\U0001F1E6-\U0001F1FF\U0001F3F4][\U0001F1E6-\U0001F1FF\U000E0000-\U000E007F‍]*)\s*(.+)$')
for row in sheet_rows('1'):
    for ref,val in row.items():
        if '\n' in val:
            name_line=val.split('\n')[0].strip()
            m=EMOJI_RE.match(name_line)
            if m:
                flag,name=m.group(1).strip(), m.group(2).strip()
                flag_by_name[norm(name)]=flag

# country -> flag fallback (incl. special England/Scotland/Wales tags)
COUNTRY_FLAG={
 'Spain':'🇪🇸','France':'🇫🇷','Argentina':'🇦🇷','Brazil':'🇧🇷','Germany':'🇩🇪','Portugal':'🇵🇹',
 'Netherlands':'🇳🇱','England':'🏴\U000e0067\U000e0062\U000e0065\U000e006e\U000e0067\U000e007f',
 'Scotland':'🏴\U000e0067\U000e0062\U000e0073\U000e0063\U000e0074\U000e007f','Belgium':'🇧🇪','Croatia':'🇭🇷',
 'Uruguay':'🇺🇾','Norway':'🇳🇴','Sweden':'🇸🇪','Switzerland':'🇨🇭','USA':'🇺🇸','Mexico':'🇲🇽','Canada':'🇨🇦',
 'Morocco':'🇲🇦','Senegal':'🇸🇳','Japan':'🇯🇵','South Korea':'🇰🇷','Colombia':'🇨🇴','Ecuador':'🇪🇨',
 'Austria':'🇦🇹','Turkey':'🇹🇷','Czech Republic':'🇨🇿','Iran':'🇮🇷','Egypt':'🇪🇬','Algeria':'🇩🇿','Qatar':'🇶🇦',
 'Bosnia & Herzegovina':'🇧🇦','New Zealand':'🇳🇿','Saudi Arabia':'🇸🇦','Poland':'🇵🇱','Denmark':'🇩🇰',
 'Nigeria':'🇳🇬','Ghana':'🇬🇭','Ivory Coast':'🇨🇮','Cameroon':'🇨🇲','Australia':'🇦🇺','Wales':'🏴\U000e0067\U000e0062\U000e0077\U000e006c\U000e0073\U000e007f',
}

# ---- tier metadata (sheet1 rows 1-2) ----
s1=sheet_rows('1')
tier_names=s1[0]   # A..G = TIER 1..7
tier_desc=s1[1]
COLS=['A','B','C','D','E','F','G']
tiers=[]
for i,c in enumerate(COLS):
    desc=tier_desc.get(c,'')
    name,_,rounds = desc.partition('—')
    tiers.append({'tier':i+1,'name':name.strip(),'rounds':rounds.strip()})

# ---- players from Player Rankings (sheet2) ----
s2=sheet_rows('2')
header={c:v.strip() for c,v in s2[0].items()}
def find_col(label):
    for c,v in header.items():
        if v.lower()==label.lower(): return c
    return None
colmap={k:find_col(k) for k in
        ['Rank','Player','Country','Group','Pos','Tier','Priority','Set Pieces','Expected Pts',
         'Club Stats','Notes','Team Strength','Expected Games','Pen Taker?','FK Taker?','Corner Taker?']}

def yes(v): return bool(v) and str(v).strip().upper().startswith('Y')
players=[]
for row in s2[1:]:
    name=row.get(colmap['Player'],'').strip()
    if not name: continue
    country=row.get(colmap['Country'],'').strip()
    flag=flag_by_name.get(norm(name)) or COUNTRY_FLAG.get(country,'🏳️')
    def num(label):
        v=row.get(colmap[label],'')
        try: return float(v)
        except: return None
    players.append({
        'id': norm(name),
        'rank': int(float(row.get(colmap['Rank'],0) or 0)),
        'name': name,
        'country': country,
        'flag': flag,
        'group': row.get(colmap['Group'],'').strip(),
        'pos': row.get(colmap['Pos'],'').strip(),
        'tier': int(float(row.get(colmap['Tier'],0) or 0)),
        'priority': row.get(colmap['Priority'],'').strip(),
        'setPieces': row.get(colmap['Set Pieces'],'').strip(),
        'expectedPts': num('Expected Pts'),
        'clubStats': row.get(colmap['Club Stats'],'').strip(),
        'notes': row.get(colmap['Notes'],'').strip(),
        'teamStrength': num('Team Strength'),
        'expectedGames': num('Expected Games'),
        'pen': yes(row.get(colmap['Pen Taker?'],'')),
        'fk': yes(row.get(colmap['FK Taker?'],'')),
        'corner': yes(row.get(colmap['Corner Taker?'],'')),
    })

players.sort(key=lambda p:p['rank'])
data={
  'meta':{'source':XLSX,'count':len(players),
          'positions':['GK','DEF','MID','FWD'],
          'note':'World Cup 2026 draft preference board — generated from Excel'},
  'tiers':tiers,
  'players':players,
}
with open(OUT,'w',encoding='utf-8') as f:
    json.dump(data,f,ensure_ascii=False,indent=2)

# summary
from collections import Counter
print('players:',len(players))
print('by pos:',dict(Counter(p['pos'] for p in players)))
print('by tier:',dict(sorted(Counter(p['tier'] for p in players).items())))
print('by priority:',dict(Counter(p['priority'] for p in players)))
miss=[p['name'] for p in players if p['flag']=='🏳️']
print('missing flags:',miss[:20], '...' if len(miss)>20 else '')
print('groups:',sorted(set(p['group'] for p in players)))
