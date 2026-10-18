#!/bin/bash
# Headless WebMCP smoke test: stub document.modelContext + stub YouTube player,
# exercises every tool/action (incl. video_size) and the video blackout mode,
# prints results and CHECK lines. Needs google-chrome.
# usage: scripts/webmcp-smoke/test.sh
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"; REPO="$(cd "$HERE/../.." && pwd)"
WT="$(mktemp -d)"; cp -r "$REPO"/. "$WT"; cd "$WT"
HERE="$HERE" python3 - <<'E'
import os
h=os.environ["HERE"]; s=open('index.html').read()
s=s.replace('<head>','<head><script>'+open(h+'/harness.js').read()+'</script>',1)
s=s.replace('</body>','<script>'+open(h+'/run.js').read()+'</script></body>')
open('index.html','w').write(s)
E
PORT=8765 node server.js >/dev/null 2>&1 & SRV=$!; sleep 1
# Full scenario with a mocked Battery Status API, then the battery API
# missing / throwing / rejecting (indicator must stay hidden, status null).
for MODE in mock none throw reject; do
  timeout 120 google-chrome --headless=new --no-sandbox --disable-gpu --virtual-time-budget=90000 --dump-dom "http://localhost:8765/?battery=$MODE" 2>/dev/null > "$WT/dom-$MODE.html" || true
done
kill $SRV 2>/dev/null || true
WT="$WT" python3 - <<'E'
import re,json,html,os,sys
fail=False
total=0; passed=0
for mode in ["mock","none","throw","reject"]:
  print("==== battery=%s ====" % mode)
  m=re.search(r'data-log="([^"]*)"',open(os.environ["WT"]+'/dom-%s.html' % mode).read())
  if not m: print("NO LOG"); fail=True; continue
  L=json.loads(html.unescape(m.group(1)))
  print("META",L["meta"]); print("ERRORS",L["errors"]); print("TOASTS",L["toasts"])
  for r in L["results"]: print(json.dumps(r)[:300])
  bad=[t for t in L["toasts"] if "unavailable" in t.lower()]
  checks=L.get("checks",[])
  for c in checks: print("CHECK", "PASS" if c["pass"] else "FAIL", c["name"], "" if c["pass"] else json.dumps(c.get("detail"))[:200])
  failed=[c for c in checks if not c["pass"]]
  total+=len(checks); passed+=len(checks)-len(failed)
  if L["errors"] or bad or L["meta"]["count"]<10 or "video_size" not in L["meta"]["names"] or "captions" not in L["meta"]["names"] or not checks or failed: fail=True
print("CHECKS %d/%d passed" % (passed, total))
sys.exit(1 if fail else 0)
E
