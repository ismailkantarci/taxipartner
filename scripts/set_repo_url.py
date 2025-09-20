#!/usr/bin/env python3
import json, sys
from pathlib import Path
cfg = Path('app.config.json')
if len(sys.argv) < 2:
    print('Usage: python3 scripts/set_repo_url.py https://github.com/<org>/<repo>')
    sys.exit(1)
url = sys.argv[1]
data = json.loads(cfg.read_text())
data['repoUrl'] = url
cfg.write_text(json.dumps(data, indent=2) + '\n')
print('repoUrl set to', url)

