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
print('PASS: scoped evidence, canonical contract, no invented live check, status mutation, unknown date. Reset to incomplete.')
