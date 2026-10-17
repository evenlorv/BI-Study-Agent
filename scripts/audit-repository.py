#!/usr/bin/env python3
"""Read-only preflight, no matched values printed. Heuristic, not a guarantee."""
from pathlib import Path
import re, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
rules={
 'OpenAI key':rb'\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}',
 'GitHub token':rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})',
 'AWS access key':rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
 'Private key':rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
 'Credential in URL':rb'https?://[^\s/:]+:[^\s/@]+@',
 'JWT':rb'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}',
 'Literal secret assignment':rb'''(?i)(?:OPENAI_API_KEY|STUDY_ACCESS_TOKEN|api_key|apiKey|password|secret)\s*[:=]\s*["']([A-Za-z0-9_+/=-]{24,})["']'''
}
findings=[]
def inspect(label,data):
 for name,pattern in rules.items():
  if re.search(pattern,data):findings.append((label,name))
files=[]
def walk(directory):
 for p in directory.iterdir():
  if p.name in {'.git','node_modules','coverage','__pycache__'}:continue
  if p.is_symlink():raise RuntimeError('Symlink requires manual audit: '+str(p.relative_to(ROOT)))
  if p.is_dir():walk(p)
  elif p.is_file():
   label=str(p.relative_to(ROOT));files.append(label);inspect(label,p.read_bytes())
   if (p.name.startswith('.env') and p.name!='.env.example') or p.suffix.lower() in {'.pem','.key','.p12','.pdf','.docx','.sqlite','.db'} or re.match(r'bi-study-agent-\d.*\.json$',p.name):findings.append((label,'Potential private file'))
walk(ROOT)
# Includes all available objects, including unreachable/reflog objects; no content is changed.
objects=subprocess.check_output(['git','cat-file','--batch-all-objects','--batch-check=%(objectname) %(objecttype)'],cwd=ROOT,text=True).splitlines()
blobs=[line.split()[0] for line in objects if line.endswith(' blob')]
for oid in blobs:inspect('git-blob:'+oid,subprocess.check_output(['git','cat-file','blob',oid],cwd=ROOT))
paths=subprocess.check_output(['git','log','--all','--format=','--name-only'],cwd=ROOT,text=True).splitlines()
for name in set(paths):
 p=Path(name)
 if (p.name.startswith('.env') and p.name!='.env.example') or p.suffix.lower() in {'.pem','.key','.p12','.pdf','.docx','.sqlite','.db'}:findings.append(('history:'+name,'Potential private file'))
for label,rule in findings:print('REVIEW:',label,'—',rule)
print(f'Checked {len(files)} working-tree files, {len(blobs)} Git blobs (all locally available objects), and historical paths. Findings: {len(findings)}.')
print('Also manually inspect fixtures, exports and data files. This scan cannot prove absence of all secrets or personal data.')
sys.exit(bool(findings))
