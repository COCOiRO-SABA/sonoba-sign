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

## 組み立てと配布(GitHub Actions)

- main に上げる → 全社のテスト環境(/dev)に自動で反映
- 本番に出す：Actions タブ →「そのばサイン 配布」→「Run workflow」→ customer(会社名 or all)・target=prod・description(何を直したか)を入れて実行。新しいバージョンを作って既存のデプロイに当てるのでURLは変わらない。戻すときは「デプロイを管理」で前のバージョンを選ぶ
- 各社のログイン情報：リポジトリの Settings → Secrets and variables → Actions に `CLASPRC_<会社名の大文字>`(例：CLASPRC_SOLRIAN)。中身は、その会社の作業アカウントで `clasp login --no-localhost` したあとの `~/.clasprc.json`
- 手元で動かす場合：`node tools/build.mjs solrian` → `python3 tools/deploy.py solrian`(テスト) / `python3 tools/deploy.py solrian --prod "説明"`(本番)
- 職員用アプリの公開範囲は必ず DOMAIN。core/app/appsscript.json で固定し、本番反映時にも確認している

## 新しい会社を足す

1. `customers/<会社>/customer.json`・`app/config.js`・`remote/config.js` を作る(solrian を参考に)
2. その会社の作業アカウントで clasp にログインし、`~/.clasprc.json` の中身をシークレット `CLASPRC_<会社名の大文字>` に登録し、`.github/workflows/deploy.yml` の env に1行足す
3. main に上げてテスト環境で確認 → 本番
