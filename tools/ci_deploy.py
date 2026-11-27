# GitHub Actions 用：会社ごとのログイン情報(シークレット CLASPRC_<会社名の大文字>)を取り出して、組み立て→配布する
#   python3 tools/ci_deploy.py <会社|all> test
#   python3 tools/ci_deploy.py <会社|all> prod "説明"
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
target, mode = sys.argv[1], sys.argv[2]
desc = sys.argv[3] if len(sys.argv) > 3 else ''
if mode == 'prod' and not desc.strip():
    sys.exit('本番に出すときは「説明」を入れてください(何を直したか)')
secrets = json.loads(os.environ.get('ALL_SECRETS', '{}'))
names = sorted(d for d in os.listdir(os.path.join(ROOT, 'customers')) if os.path.exists(os.path.join(ROOT, 'customers', d, 'customer.json')))
if target != 'all':
    if target not in names: sys.exit(f'会社が見つかりません: {target}(あるのは {names})')
    names = [target]
failed = []
for n in names:
    key = 'CLASPRC_' + n.upper()
    if key not in secrets:
        print(f'⚠ {n}: シークレット {key} がないため飛ばします'); 
        if target != 'all': failed.append(n)
        continue
    path = f'/tmp/clasprc_{n}.json'
    open(path, 'w').write(secrets[key]); os.chmod(path, 0o600)
    env = dict(os.environ, CLASPRC_PATH=path)
    print(f'===== {n}：{"本番" if mode == "prod" else "テスト"} =====', flush=True)
    r1 = subprocess.run(['node', 'tools/build.mjs', n], cwd=ROOT, env=env)
    args = ['python3', 'tools/deploy.py', n] + (['--prod', desc] if mode == 'prod' else [])
    r2 = subprocess.run(args, cwd=ROOT, env=env) if r1.returncode == 0 else r1
    os.remove(path)
    if r2.returncode != 0: failed.append(n)
if failed: sys.exit('失敗した会社: ' + ', '.join(failed))
