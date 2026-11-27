# そのばサイン(標準版)

介護事業所の契約書類を、その場または遠隔で電子サインまで終わらせるしくみ。COCOiROが各社のGoogle Workspaceに構築する。

## 構成

- `core/app` … 職員用アプリの共通の本体(書類発行・1回のサイン・署名記録・説明方法・遠隔サインのリンク発行)
- `core/remote` … 遠隔サイン専用アプリの共通の本体(アクセス：全員)
- `options/<名前>` … オプション(追加課金)。`kousoku` = 身体拘束の説明・同意書と経過表
  - `*.js` はそのまま追加、`form.html` は書類発行画面、`script.html` は画面のスクリプトに差し込む
- `customers/<会社>/` … 会社ごとの設定
  - `customer.json` … GASのプロジェクトID・本番デプロイID・使うオプション
  - `app/config.js` … 事業所の一覧、マスターのタブ、同意書の項目、ヘッダーの表記など
  - `app/legacy_*.js` … その会社で1回だけ実行した作業(本体からは呼ばない)
  - `remote/config.js` … マスターのID

## 組み立てと配布

```
node tools/build.mjs solrian           # dist/solrian/{app,remote} を作る
python3 tools/deploy.py solrian        # テスト(HEAD)に反映するだけ
python3 tools/deploy.py solrian --prod "説明"   # 新しいバージョンを作り、本番デプロイに当てる(URLは変わらない)
```

- 配布には各社の作業アカウントで clasp にログインしておく(`clasp login --no-localhost`)
- 本番に出す前に、テスト(/dev)と一時テスト関数で確認する
- 職員用アプリの公開範囲は必ず DOMAIN(その会社のドメインの全員)。core/app/appsscript.json で固定している
