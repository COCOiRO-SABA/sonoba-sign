# Apps Script API の小さな道具(claspのログイン情報を使う)
import json, os, sys, urllib.request, urllib.parse
def token():
    rc = json.load(open(os.environ.get('CLASPRC_PATH', os.path.expanduser('~/.clasprc.json'))))
    t = rc.get('tokens', {}).get('default', rc.get('token', {}))
    d = urllib.parse.urlencode({'client_id': t['client_id'], 'client_secret': t['client_secret'], 'refresh_token': t['refresh_token'], 'grant_type': 'refresh_token'}).encode()
    return json.load(urllib.request.urlopen('https://oauth2.googleapis.com/token', d))['access_token']
def call(path, method='GET', body=None):
    req = urllib.request.Request('https://script.googleapis.com/v1/' + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req))
if __name__ == '__main__':
    cmd, pid = sys.argv[1], sys.argv[2]
    if cmd == 'files':
        print([f['name'] for f in call(f'projects/{pid}/content')['files']])

def push_dir(pid, d):
    """dist のフォルダの中身で、プロジェクトのファイルをまるごと置き換える(filePushOrder の順)"""
    import os
    cl = json.load(open(os.path.join(d, '.clasp.json')))
    order = cl.get('filePushOrder', [])
    names = [f for f in os.listdir(d) if not f.startswith('.')]
    names.sort(key=lambda f: (order.index(f) if f in order else len(order) + (0 if f.endswith('.js') else 1), f))
    files = []
    for f in names:
        src = open(os.path.join(d, f), encoding='utf-8').read()
        if f == 'appsscript.json': files.append({'name': 'appsscript', 'type': 'JSON', 'source': src})
        elif f.endswith('.js'): files.append({'name': f[:-3], 'type': 'SERVER_JS', 'source': src})
        elif f.endswith('.html'): files.append({'name': f[:-5], 'type': 'HTML', 'source': src})
    call(f'projects/{pid}/content', 'PUT', {'files': files})
    return [f['name'] for f in files]
