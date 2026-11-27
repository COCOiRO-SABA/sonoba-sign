# そのばサイン 配布：dist/<会社> を各社のGASに反映する
#   python3 tools/deploy.py solrian                 → テスト(HEAD)に反映するだけ
#   python3 tools/deploy.py solrian --prod "説明"    → 新しいバージョンを作り、本番デプロイに当てる(URLは変わらない)
# 先に node tools/build.mjs <会社> を実行しておく。clasp のログインは、その会社の作業アカウントで。
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import gas_api as g
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
name = sys.argv[1]
prod = '--prod' in sys.argv
desc = sys.argv[sys.argv.index('--prod') + 1] if prod else ''
cust = json.load(open(os.path.join(ROOT, 'customers', name, 'customer.json')))
for part in ('app', 'remote'):
    if part not in cust: continue
    pid = cust[part]['scriptId']
    files = g.push_dir(pid, os.path.join(ROOT, 'dist', name, part))
    print(f'{part}: テストに反映 {files}')
    if prod:
        if part == 'app':
            man = json.load(open(os.path.join(ROOT, 'dist', name, part, 'appsscript.json')))
            assert man['webapp']['access'] == 'DOMAIN', '職員用アプリの公開範囲が DOMAIN ではありません'
        v = g.call(f'projects/{pid}/versions', 'POST', {'description': desc})['versionNumber']
        dep = cust[part]['deploymentId']
        g.call(f'projects/{pid}/deployments/{dep}', 'PUT', {'deploymentConfig': {'scriptId': pid, 'versionNumber': v, 'manifestFileName': 'appsscript', 'description': desc}})
        print(f'{part}: 本番をバージョン{v}に更新')
