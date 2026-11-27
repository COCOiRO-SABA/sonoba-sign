# Solrian v11(v12) のコードを「共通の本体」「オプション」「Solrianの設定・過去の作業」に分ける(1回だけ使う)
import os, re, shutil, json
SRC = "/home/claude/sonoba-core/_pull/solrian"
RSRC = "/home/claude/sonoba-core/_pull/solrian-remote"
ROOT = "/home/claude/sonoba-core"
def rd(p): return open(os.path.join(SRC, p), encoding="utf-8").read()
def wr(p, s):
    p = os.path.join(ROOT, p); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8").write(s)
def cut(s, start, end, include_end=False):
    i = s.index(start); j = s.index(end, i) + (len(end) if include_end else 0)
    return s[:i] + s[j:], s[i:j]
def one(s, a, b):
    assert s.count(a) == 1, (a[:60], s.count(a)); return s.replace(a, b)

# ---------- コード.js ----------
code = rd("コード.js")
code, cfg1 = cut(code, "const MASTER_SHEETS = [", "function getOffice_(key) {")
code, legacy_seed = cut(code, "/** マスターの初期データ（タグ名, 値, 備考） */", "/** 初期セットアップ：タブ作成＋データ投入＋デザイン適用 */")

i = code.index("// ================= Solrian移設（初回のみ実行） =================")
legacy_mig = code[i:]; code = code[:i]
code = one(code, '    .addItem("【初回のみ】Solrian移設", "migrateToSolrian")\n', "")
code = one(code, '["", "Solrian 契約書類 かんたん作成シート"],', '["", CONFIG.guideTitle],')
code = one(code, 'const data = initialMasterData_();', 'const data = typeof initialMasterData_ === "function" ? initialMasterData_() : {};')
code = one(code, '.concat(data[def.name]);', '.concat(data[def.name] || []);')
code = one(code, '.concat(initialTemplateData_());', '.concat(typeof initialTemplateData_ === "function" ? initialTemplateData_() : []);')
code = code.replace("// 出力先フォルダ（Solrian様：10.そのばサイン／利用契約書）。migrateToSolrianで自動設定", "// 出力先フォルダ（10.そのばサイン／利用契約書）。スクリプトプロパティ")
code = one(code, "function getOffice_(key) {", "// 事業所の一覧（OFFICES・DEFAULT_OFFICE・MASTER_SHEETS）は会社ごとの設定ファイル（config.js）にある\nfunction getOffice_(key) {")

# ---------- Webapp.js ----------
web = rd("Webapp.js")
web, cfg2 = cut(web, "/** 個人情報同意書の「する・しない」の項目", "function generateForClient(form) {")
web, kousoku = cut(web, "// ============================================================\n// 身体拘束の説明・同意書と経過表", "// ============================================================\n// 遠隔サイン")
web = one(web, 'const EXPLAIN_TAG = "通所_説明方法の選択肢";', 'const EXPLAIN_TAG = CONFIG.explainTag;')
web = one(web, 'const phone = master["通所_電話"] || "";', 'const phone = master[CONFIG.officePhoneTag] || "";')
web = web.replace("// ・サイン専用アプリは別のGASプロジェクト「Solrian_そのばサイン_遠隔サイン」（アクセス：全員）", "// ・サイン専用アプリは別のGASプロジェクト「〇〇_そのばサイン_遠隔サイン」（アクセス：全員）")
web = web.replace("// ・説明方法の選択肢は、事業所ごとのマスターの「通所_説明方法の選択肢」（「、」区切り）", "// ・説明方法の選択肢は、事業所ごとのマスターの CONFIG.explainTag（「、」区切り）")

# ---------- admin_import.js ----------
adm = rd("admin_import.js")
adm, conv = cut(adm, "/** docx File を Google ドキュメントに変換して新IDを返す", "/** 訪問契約書テンプレを元docx")
adm, setcell = cut(adm, "function setCellText_(cell, text) {", "/** 共有フォルダのテンプレ類")
helpers = "/**\n * 共通の部品(テンプレートの取り込みで使う)\n */\n\n" + conv + setcell

# ---------- index.html ----------
html = rd("index.html")
html = one(html, "<small>Solrian 様専用 ／", "<small><?= headerNote ?> ／")
html, form = cut(html, "    <!-- 2026-11-23 COCOiRO v8：つくる書類の切り替え -->", "    <div class=\"card\">\n      <h2>📑 契約書類一式</h2>")
html = html.replace("    <div class=\"card\">\n      <h2>📑 契約書類一式</h2>", "<!--@@OPTION:form-->\n    <div class=\"card\">\n      <h2>📑 契約書類一式</h2>", 1)
html, script = cut(html, "/* ================= 身体拘束の説明・同意書（2026-11-23 COCOiRO v8） ================= */", "</script>")
html = html.replace("</script>", "/*@@OPTION:script*/\n</script>", 1)
html = one(html, "const m = res.meta; renderKeika(m, client); renderRemote(res, client);", "const m = res.meta; if (typeof renderKeika === \"function\") renderKeika(m, client); renderRemote(res, client);")

# doGet に headerNote を渡す
web = one(web, "  t.officeName = office.name;\n", "  t.officeName = office.name;\n  t.headerNote = CONFIG.headerNote;\n")

wr("core/app/コード.js", code)
wr("core/app/Webapp.js", web)
wr("core/app/helpers.js", helpers)
wr("core/app/index.html", html)
man = json.load(open(os.path.join(SRC, "appsscript.json")))
man["webapp"] = {"executeAs": "USER_DEPLOYING", "access": "DOMAIN"}
wr("core/app/appsscript.json", json.dumps(man, indent=2, ensure_ascii=False) + "\n")

wr("options/kousoku/kousoku.js", kousoku)
wr("options/kousoku/form.html", form)
wr("options/kousoku/script.html", script)

config = """/**
 * そのばサイン 会社ごとの設定(Solrian)
 * 共通の本体(core)と組み合わせて配る。ここ以外の会社固有の値は、マスター(スプレッドシート)とスクリプトプロパティに置く。
 */
const CONFIG = {
  customer: "solrian",
  headerNote: "Solrian 様専用",
  guideTitle: "Solrian 契約書類 かんたん作成シート",
  officePhoneTag: "通所_電話",              // 遠隔サインの文面に入れる事業所の電話(マスターのタグ名)
  explainTag: "通所_説明方法の選択肢"        // 説明方法の選択肢(事業所ごとのマスターのタグ名)
};

""" + cfg1 + "\n" + cfg2
wr("customers/solrian/app/config.js", config)
wr("customers/solrian/app/legacy_solrian.js", "/**\n * Solrian の過去の作業(1回だけ実行したもの・初期データ)。本体からは呼ばない。\n */\n\n" + legacy_seed + legacy_mig)
wr("customers/solrian/app/legacy_admin_import.js", adm)

# ---------- 遠隔サイン ----------
rc = open(os.path.join(RSRC, "コード.js"), encoding="utf-8").read()
rc = one(rc, 'const MASTER_ID = "1ExPJaUGKibTInJoBjnufTJZZ6hYyOm2KJkxcvahNntU"; // Solrian_契約書類マスター\n', "// MASTER_ID は会社ごとの設定(config.js)にある\n")
rc = rc.replace(" * そのばサイン 遠隔サイン(Solrian)  2026-11-26 COCOiRO", " * そのばサイン 遠隔サイン  2026-11-26 COCOiRO")
rc = rc.replace("実行ユーザー：自分(cocoiro@solrian.net)", "実行ユーザー：自分(各社の作業アカウント)")
rc = rc.replace("職員用アプリ(Solrian_そのばサイン)", "職員用アプリ(〇〇_そのばサイン)")
wr("core/remote/コード.js", rc)
shutil.copy(os.path.join(RSRC, "index.html"), os.path.join(ROOT, "core/remote/index.html"))
shutil.copy(os.path.join(RSRC, "appsscript.json"), os.path.join(ROOT, "core/remote/appsscript.json"))
wr("customers/solrian/remote/config.js", '/** 遠隔サインの会社ごとの設定(Solrian) */\nconst MASTER_ID = "1ExPJaUGKibTInJoBjnufTJZZ6hYyOm2KJkxcvahNntU"; // Solrian_契約書類マスター\n')
print("ok")
