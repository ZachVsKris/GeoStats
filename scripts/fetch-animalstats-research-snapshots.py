#!/usr/bin/env python3
"""Restore checked additional research downloads; fail before replacing on hash drift."""
import hashlib,json,urllib.request
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/animalstats'
for row in json.loads((P/'research/additional-downloads.json').read_text()):
 target=P/'source'/row['file']
 if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()==row['sha256']:continue
 with urllib.request.urlopen(row['url'],timeout=30) as response:body=response.read()
 if hashlib.sha256(body).hexdigest()!=row['sha256']:raise ValueError('Source changed; review before replacement: '+row['file'])
 target.parent.mkdir(exist_ok=True);target.write_bytes(body)
 print('Verified',row['file'])
