"""Regression checks for evidence, freshness and real status mutation."""
import sqlite3
from demo import run, setup, live
setup(True)
naive=run(mode='naive')
assert naive['evidence'][0]['id']=='01_legacy'
assert 'finance.daily_revenue' in naive['answer']
index_only=run(mode='context',disabled=['metadata','rewrite','rerank','authority'])
assert [line.split(':',1)[0] for line in index_only['trace']]==['index','offline retrieval']
metadata_only=run(mode='context',disabled=['rewrite','rerank','authority'])
assert all(d['region']=='EU' and d['environment']=='prod' and d['status']=='active' and d['access']=='internal' for d in metadata_only['evidence'])
rewrite_only=run(mode='context',disabled=['rerank','authority'])
assert any(line.startswith('rewrite:') for line in rewrite_only['trace'])
rerank_only=run(mode='context',disabled=['authority'])
assert any(line.startswith('rerank:') for line in rerank_only['trace'])
r=run()
assert r['evidence'][0]['id']=='02_contract'
assert any(line.startswith('index:') for line in r['trace'])
assert any(line.startswith('rerank:') for line in r['trace'])
assert any(d['id']=='02_contract' for d in r['evidence'])
assert all(d['environment']=='prod' and d['region']=='EU' and d['status']=='active' for d in r['evidence'])
assert r['live_status']['complete'] is False
assert run(mode='context')['live_status'] is None
assert run(disabled=['live'])['live_status'] is None
with sqlite3.connect(setup()) as c: c.execute("UPDATE partitions SET status='complete' WHERE country='DE'")
assert run()['live_status']['complete'] is True
assert live('2099-01-01')['complete'] is False
setup(True)

# --- Deck drift guard ---------------------------------------------------
# The slide deck (conference-deck/rag-truth-deck.html) hardcodes the confidence
# and canonical-rank ladders as literal JS arrays, because a static slide cannot
# run Python. Recompute both from the live pipeline and assert the deck still
# matches, so the two can never silently diverge.
import re
from demo import canonical_rank, ROOT
setup(True)
stage_runs=[
    run(mode='naive'),
    run(mode='context',disabled=['metadata','rewrite','rerank','authority']),
    run(mode='context',disabled=['rewrite','rerank','authority']),
    run(mode='context',disabled=['rerank','authority']),
    run(mode='context',disabled=['authority']),
    run(mode='context'),
    run(mode='live'),
]
with sqlite3.connect(setup()) as c: c.execute("UPDATE partitions SET status='complete' WHERE country='DE'")
stage_runs.append(run(mode='live'))
setup(True)
conf_actual=[s['confidence'] for s in stage_runs]
rank_actual=['#%d'%(canonical_rank(s['evidence'])+1) for s in stage_runs]
deck=(ROOT/'conference-deck/rag-truth-deck.html').read_text()
conf_deck=[int(x) for x in re.search(r'const CONF\s*=\s*\[([^\]]*)\]',deck).group(1).split(',')]
rank_deck=re.findall(r'"(#\d)"',re.search(r'const RANK\s*=\s*\[([^\]]*)\]',deck).group(1))
assert conf_deck==conf_actual, f'Deck CONF {conf_deck} != pipeline {conf_actual} — update conference-deck/rag-truth-deck.html'
assert rank_deck==rank_actual, f'Deck RANK {rank_deck} != pipeline {rank_actual} — update conference-deck/rag-truth-deck.html'
setup(True)
print('PASS: scoped evidence, canonical contract, no invented live check, status mutation, unknown date, deck ladder in sync. Reset to incomplete.')
