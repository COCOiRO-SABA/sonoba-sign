/**
 * Solrian の過去の作業(1回だけ実行したもの・初期データ)。本体からは呼ばない。
 */

/** マスターの初期データ（タグ名, 値, 備考） */
function initialMasterData_() {
  return {
    "マスター_共通": [
      ["法人_名称", "株式会社Steady", "法人共通"],
      ["法人_代表者名", "可知 久美子", "「代表取締役」は書類側の固定文字"],
      ["法人_所在地", "岐阜県中津川市中津川2547-459", "半角入力OK・自動で全角になります"],
      ["法人_電話", "046-801-0808", ""]
    ],
    "マスター_訪問": [
      ["訪問_事業所名", "ケアステーションSteady", ""],
      ["訪問_事業所番号", "1471907749", ""],
      ["訪問_郵便番号", "239-0843", "「〒」は書類側の固定文字"],
      ["訪問_所在地", "神奈川県横須賀市津久井1丁目14-3", "県から書く"],
      ["訪問_実施地域", "横須賀市全域、三浦市", ""],
      ["訪問_電話", "046-839-2161", ""],
      ["訪問_FAX", "046-839-2166", ""],
      ["訪問_管理者名", "高木 譲", "★管理者交代時はここを変更"],
      ["訪問_営業日", "月曜日から金曜日、祝祭日", "事務所"],
      ["訪問_営業時間", "9:00~18:00", "事務所"],
      ["訪問_サービス提供時間", "365日24時間", ""],
      ["訪問_職員体制基準日", "2025年10月1日", "職員体制の「現在」日付"],
      ["訪問_職員_管理者", "常勤1名(1名兼務)・非常勤0名", "★人数変更時はここ"],
      ["訪問_職員_サ責", "常勤1名(1名兼務)・非常勤0名", "★"],
      ["訪問_職員_介護福祉士", "常勤1名・非常勤7名", "★"],
      ["訪問_職員_実務者", "常勤0名・非常勤1名", "★"],
      ["訪問_職員_初任者", "常勤2名・非常勤1名", "★"],
      ["訪問_加算区分", "Ⅱロ", "★処遇改善加算の区分"],
      ["訪問_加算料率", "26.6", "★区分とセットで変更（%は書類側固定）"]
    ],
    "マスター_通所": [
      ["通所_事業所名", "デイサービスSteady津久井浜", ""],
      ["通所_事業所番号", "1491901060", ""],
      ["通所_郵便番号", "239-0843", "※要確認"],
      ["通所_所在地", "神奈川県横須賀市津久井1-14-3", ""],
      ["通所_実施地域", "横須賀市", ""],
      ["通所_電話", "046-839-2161", ""],
      ["通所_FAX", "046-839-2166", ""],
      ["通所_管理者名", "川口 克代", "★管理者交代時はここを変更"],
      ["通所_利用定員", "10", "「名」は書類側固定"],
      ["通所_営業日", "月曜日～日曜日（祝日を含む）", ""],
      ["通所_営業時間", "8:00~18:00", ""],
      ["通所_サービス提供時間", "9:00~17:00", ""],
      ["通所_職員体制基準日", "2026年2月1日", "※要確認"],
      ["通所_職員_管理者", "常勤兼務1名", "★人数変更時はここ"],
      ["通所_職員_生活相談員", "常勤専従4名・常勤兼務1名・非常勤専従2名・非常勤兼務4名", "★"],
      ["通所_職員_介護職員", "常勤専従4名・常勤兼務1名・非常勤専従1名・非常勤兼務4名", "★"],
      ["通所_職員_機能訓練指導員", "常勤専従1名・非常勤兼務1名", "★"],
      ["通所_職員_看護職員", "常勤専従2名・常勤兼務1名・非常勤兼務1名", "★"],
      ["通所_加算区分", "Ⅱロ", "★処遇改善加算の区分"],
      ["通所_加算料率", "12.5", "★区分とセットで変更（%は書類側固定）"]
    ],
    "マスター_ホーム": [
      ["ホーム_施設名", "ケアホームSteady", "契約書の施設名称欄の表記※要確認"],
      ["ホーム_施設名略", "Steady", "「有料老人ホーム○○」の○○部分"],
      ["ホーム_居室数", "19", "数字のみ"],
      ["ホーム_定員", "19", "数字のみ"],
      ["ホーム_電話", "046-839-2161", "苦情・相談窓口"],
      ["ホーム_FAX", "046-839-2166", ""]
    ]
  };
}

/** テンプレートタブの初期データ（URL, 出力名）※既存タブがある場合は使われません */
function initialTemplateData_() {
  return [
    ["https://docs.google.com/document/d/18niwm5Ez2OKCCBfVO5TkFYx774mS81JQW3dhcMSTh1M/edit", "訪問_重要事項説明書"],
    ["（訪問_契約書のDocs URLを貼る）", "訪問_契約書"],
    ["（訪問_運営規程のDocs URLを貼る）", "訪問_運営規程"],
    ["https://docs.google.com/document/d/1AgNQ2HdfV9X580YXFWR0RXbYtM92gDTe3fytaiQyx1A/edit", "通所_重要事項説明書"],
    ["https://docs.google.com/document/d/19aaES8gl0xM37FWlJaRO3nXYRMXQmLaxhP6SGFeL2M8/edit", "通所_契約書"],
    ["https://docs.google.com/document/d/1WeLNDANn0za5QW2ycW7H_pYwSqwcwgTEvoSpz56YKCw/edit", "介護S_重要事項説明書"],
    ["（ホーム_契約書のDocs URLを貼る）", "ホーム_入居契約書"],
    ["（ホーム_管理規程のDocs URLを貼る）", "ホーム_管理規程"]
  ];
}

// ================= Solrian移設（初回のみ実行） =================
/**
 * COCOiRO側で準備したテンプレート・マスターを Solrian のワークスペースへ移設する。
 * ・共有ドライブ「10.そのばサイン」に「00_システム（COCOiRO管理）／テンプレート」と「利用契約書」を作成
 * ・テンプレート5本をコピーし、テンプレートタブを差し替え
 * ・マスター_共通／マスター_通所 を Solrian の値に差し替え、訪問・ホームのタブを削除
 * ・出力先フォルダIDをスクリプトプロパティに保存
 */
function migrateToSolrian() {
  const SRC_MASTER_ID = "1_OQ_adKsHn2ISiXaJs3Mk6xgNk4sGsKMeooGRFqWDlM";
  const SHARED_DRIVE_ID = "0ACSKEvttVlamUk9PVA";
  const TEMPLATES = [
    ["1RDsv20bhz1XR0-qlClRDHx7UTeYtvYS4NA4M6CZ8p00", "通所_重要事項説明書"],
    ["1VKs0r20X3pDVdChjcY5SPiJRPZEGA4Bx9-wtPY7FKuc", "通所_契約書"],
    ["1ExG9oM6qQi-g8eInOtOPftIdBh8jY0ajHVbMoQ1GFYg", "通所_個人情報同意書"],
    ["1jSbtn725erd1L9YmRjospQJuGf_LvI1SuUndjCSe7MM", "介護S_重要事項説明書"],
    ["1-5915uSO-KK6w4JkynvkCD8flACX1TFEERpy0_rubgM", "介護S_契約書"]
  ];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const root = DriveApp.getFolderById(SHARED_DRIVE_ID);
  const getOrMake = function (parent, name) {
    const it = parent.getFoldersByName(name);
    return it.hasNext() ? it.next() : parent.createFolder(name);
  };
  const sysFolder = getOrMake(root, "00_システム（COCOiRO管理）");
  const tplFolder = getOrMake(sysFolder, "テンプレート");
  const outFolder = getOrMake(root, "利用契約書");

  const tplRows = [["テンプレートDocsのURL", "出力ファイル名"]];
  TEMPLATES.forEach(function (t) {
    const copy = DriveApp.getFileById(t[0]).makeCopy(t[1] + "_テンプレート", tplFolder);
    tplRows.push(["https://docs.google.com/document/d/" + copy.getId() + "/edit", t[1]]);
  });
  const tpl = ss.getSheetByName(SHEET_TEMPLATE);
  tpl.getRange(1, 1, tpl.getMaxRows(), 2).clearContent();
  tpl.getRange(1, 1, tplRows.length, 2).setValues(tplRows);

  const src = SpreadsheetApp.openById(SRC_MASTER_ID);
  ["マスター_共通", "マスター_通所"].forEach(function (n) {
    const v = src.getSheetByName(n).getDataRange().getDisplayValues();
    const sh = ss.getSheetByName(n);
    sh.getRange(1, 1, sh.getMaxRows(), 3).clearContent();
    if (sh.getMaxRows() < v.length) sh.insertRowsAfter(sh.getMaxRows(), v.length - sh.getMaxRows());
    sh.getRange(2, 1, 1, 3).copyFormatToRange(sh, 1, 3, 2, v.length);
    sh.getRange(1, 2, v.length, 1).setNumberFormat("@");
    sh.getRange(1, 1, v.length, 3).setValues(v.map(function (r) { return [r[0], r[1], r[2]]; }));
  });
  ["マスター_訪問", "マスター_ホーム"].forEach(function (n) {
    const sh = ss.getSheetByName(n);
    if (sh) ss.deleteSheet(sh);
  });

  PropertiesService.getScriptProperties().setProperty("OUTPUT_FOLDER_ID", outFolder.getId());
  ss.rename("Solrian_契約書類マスター");
  DriveApp.getFileById(ss.getId()).moveTo(sysFolder);

  Logger.log("出力先フォルダ: " + outFolder.getUrl());
  Logger.log("テンプレート: " + tplFolder.getUrl());
}


/** テンプレート全件から㊞マークを削除する（2026/10 Solrian様 押印欄廃止） */
function removeHankoFromTemplates() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TEMPLATE);
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const log = [];
  rows.forEach(function (r) {
    const m = String(r[0]).match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!m) return;
    const doc = DocumentApp.openById(m[1]);
    const body = doc.getBody();
    let n = 0;
    let found = body.findText("㊞");
    while (found) { n++; found = body.findText("㊞", found); }
    body.replaceText("[ 　]*㊞", "");
    doc.saveAndClose();
    log.push(r[1] + "：" + n + "件削除");
  });
  Logger.log(log.join("\n"));
}


// ================= v6 テンプレート更新（2026-11-04 COCOiRO・1回だけ実行） =================
/**
 * 利用者・家族が手書きする欄をなくすため、テンプレートにタグを入れる。
 * ・利用者／代理人の住所欄 → {{利用者_住所}} {{代理人_住所}}
 * ・契約書の「令和　年　月　日（利用開始予定日）」 → {{利用開始日}}
 * ・通所契約書の冒頭「利用者　（以下「甲」…」 → {{利用者_氏名}}
 * ・個人情報同意書の「する・しない」 → {{同意_1}}〜、写真の3択 → {{写真_1}}〜
 * 何度実行しても、入れ済みの箇所は変わらない。
 */
function migrateTemplatesV6() {
  const log = [];
  loadTemplates_().forEach(function (tpl) {
    const doc = DocumentApp.openById(extractDocId_(tpl.url));
    const body = doc.getBody();
    const edits = [];

    // 住所欄（表の「住所」の右が空欄のもの）
    body.getTables().forEach(function (table) {
      let context = "";
      for (let ri = 0; ri < table.getNumRows(); ri++) {
        const row = table.getRow(ri);
        const n = row.getNumCells();
        const first = n > 0 ? row.getCell(0).getText().replace(/[\s　]/g, "") : "";
        if (first) context = first;
        for (let ci = 0; ci < n - 1; ci++) {
          if (row.getCell(ci).getText().replace(/[\s　]/g, "") !== "住所") continue;
          const target = row.getCell(ci + 1);
          if (target.getText().replace(/[\s　]/g, "") !== "") continue;
          if (context.indexOf("代理人") >= 0 || context.indexOf("家族") >= 0) {
            setCellText_(target, "{{代理人_住所}}"); edits.push("代理人の住所");
          } else if (context.indexOf("利用者") >= 0 || context.indexOf("甲") >= 0) {
            setCellText_(target, "{{利用者_住所}}"); edits.push("利用者の住所");
          }
        }
      }
    });

    // 利用開始予定日
    const startPat = "令和[ 　]*年[ 　]*月[ 　]*日（利用開始予定日）";
    if (body.findText(startPat)) {
      body.replaceText(startPat, "{{利用開始日}}（利用開始予定日）"); edits.push("利用開始日");
    }

    // 通所契約書の冒頭の利用者名
    const headPat = "利用者[ 　]+（以下「甲」";
    if (body.findText(headPat)) {
      body.replaceText(headPat, "利用者 {{利用者_氏名}}（以下「甲」"); edits.push("冒頭の利用者名");
    }

    // 個人情報同意書
    if (body.getText().indexOf("{{同意_1}}") < 0) {
      const pat = "する[ 　]*・[ 　]*しない";
      const hits = [];
      let f = body.findText(pat);
      while (f) {
        // 説明文の「（する・しない）を○印で」は除き、「する ・ しない」だけの欄を対象にする
        if (f.getElement().asText().getText().replace(/[\s　]/g, "") === "する・しない") hits.push(f);
        f = body.findText(pat, f);
      }
      if (hits.length > 0) {
        const paras = body.getParagraphs();
        const photoParas = PHOTO_CHOICES.map(function (choice) {
          const key = choice.replace(/[\s　]/g, "");
          return paras.filter(function (p) { return p.getText().replace(/[\s　]/g, "") === key; });
        });
        if (hits.length !== CONSENT_ITEMS.length || photoParas.some(function (a) { return a.length !== 1; })) {
          edits.push("⚠同意書の形が想定と違うため未変更（する・しない" + hits.length + "件、写真" + photoParas.map(function (a) { return a.length; }).join("/") + "）");
        } else {
          for (let i = hits.length - 1; i >= 0; i--) {
            const t = hits[i].getElement().asText();
            t.deleteText(hits[i].getStartOffset(), hits[i].getEndOffsetInclusive());
            t.insertText(hits[i].getStartOffset(), "{{同意_" + (i + 1) + "}}");
          }
          photoParas.forEach(function (a, i) { a[0].editAsText().insertText(0, "{{写真_" + (i + 1) + "}} "); });
          edits.push("同意" + hits.length + "件・写真" + photoParas.length + "件");
        }
      }
    }

    doc.saveAndClose();
    log.push(tpl.outName + "：" + (edits.join("、") || "変更なし"));
  });
  Logger.log("==テンプレート更新v6==\n" + log.join("\n"));
}


// ================= v7 事業所の追加（2026-11-04 COCOiRO・1回だけ実行） =================
/**
 * 苗木のマスタータブ（マスター_通所）をもとに、5事業所分のマスタータブを作る。
 * ・苗木：マスター_通所 をコピーして「マスター_通所_苗木」に（元のタブは v7 の本番反映まで残す）
 * ・ほか4事業所：苗木をコピーし、コーポレートサイト（solrian.jp）から分かる値だけ入れる。
 *   分からない値は空欄にして、メモに苗木の値を参考として残す
 * ・利用契約書フォルダの中に事業所ごとのフォルダを作る（既存の苗木の利用者フォルダは動かさない）
 * 何度実行しても、作成済みのタブ・フォルダは変わらない。
 */
function setupOfficesV7() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = [];
  const SITE = "コーポレートサイト（solrian.jp）より";
  const SAME = "=苗木"; // 苗木と同じ値を入れる印

  let base = ss.getSheetByName(getOffice_("naegi").sheet);
  if (!base) {
    const old = ss.getSheetByName("マスター_通所");
    if (!old) throw new Error("「マスター_通所」タブが見つかりません。");
    base = old.copyTo(ss).setName(getOffice_("naegi").sheet);
    ss.setActiveSheet(base);
    ss.moveActiveSheet(old.getIndex() + 1);
    log.push("マスター_通所 をコピーして " + base.getName() + " を作成");
  }
  const naegi = {};
  base.getRange(2, 1, base.getLastRow() - 1, 2).getValues().forEach(function (r) {
    naegi[String(r[0]).trim()] = masterValueToString_(r[1]);
  });

  const kokuho = {
    "通所_国保連名": [SAME, "苗木と同じ（岐阜県共通）"],
    "通所_国保連住所": [SAME, "苗木と同じ（岐阜県共通）"],
    "通所_国保連電話": [SAME, "苗木と同じ（岐阜県共通）"],
    "通所_国保連受付時間": [SAME, "苗木と同じ（岐阜県共通）"]
  };
  const day4 = {
    "通所_利用定員": ["18", "サイト：18名（夜間6名まで）"],
    "通所_営業日": [SAME, "※要確認（サイトは4事業所とも「24時間365日年中無休」。苗木と同じ表記にした）"],
    "通所_サービス提供時間": ["9:00~17:30", SITE]
  };
  const data = {
    misato: {
      "通所_事業所名": ["デイサービス向日葵三郷", SITE],
      "通所_事業所番号": ["2171701010", SITE],
      "通所_郵便番号": ["509-7124", "※要確認（サイトに記載なし。介護情報サイトの値）"],
      "通所_所在地": ["岐阜県恵那市三郷町佐々良木194-339", SITE],
      "通所_実施地域": ["恵那市", SITE],
      "通所_電話": ["0573-28-5027", SITE],
      "通所_FAX": ["0573-28-5028", SITE],
      "通所_保険者名": ["恵那市", "※所在地の市。保険者の住所・電話・受付時間は要入力"]
    },
    nakatsugawa: {
      "通所_事業所名": ["デイサービス向日葵中津川", SITE],
      "通所_事業所番号": ["2191500236", SITE],
      "通所_郵便番号": ["508-0001", "※要確認（サイトに記載なし。介護情報サイトの値）"],
      "通所_所在地": ["岐阜県中津川市中津川3946-96", SITE],
      "通所_実施地域": ["中津川市", SITE],
      "通所_電話": ["0573-64-8350", SITE],
      "通所_FAX": ["0573-64-8351", SITE],
      "通所_保険者名": [SAME, "苗木と同じ（中津川市）"],
      "通所_保険者住所": [SAME, "苗木と同じ（中津川市）"],
      "通所_保険者電話": [SAME, "苗木と同じ（中津川市）"],
      "通所_保険者受付時間": [SAME, "苗木と同じ（中津川市）"]
    },
    nagata: {
      "通所_事業所名": ["デイサービス向日葵永田", SITE],
      "通所_事業所番号": ["2191700273", SITE],
      "通所_郵便番号": ["509-7204", "コーポレートサイトの本社住所（同じ所在地）より"],
      "通所_所在地": ["岐阜県恵那市長島町永田673-7", SITE],
      "通所_実施地域": ["恵那市", SITE],
      "通所_電話": ["0573-59-9500", SITE],
      "通所_FAX": ["0573-59-9501", SITE],
      "通所_保険者名": ["恵那市", "※所在地の市。保険者の住所・電話・受付時間は要入力"]
    },
    seiraku: {
      "通所_事業所名": ["デイサービス向日葵生楽", SITE],
      "通所_事業所番号": ["2191100284", SITE],
      "通所_所在地": ["岐阜県多治見市滝呂町1-79-1", SITE],
      "通所_電話": ["0572-21-3336", SITE],
      "通所_FAX": ["0572-21-3361", SITE],
      "通所_利用定員": ["18", "サイト：要介護18名・要支援18名（予防あり）"],
      "通所_営業日": ["月曜日～土曜日", SITE],
      "通所_サービス提供時間": ["9:00~16:15", SITE],
      "通所_夜間サポート時間": ["", "※要確認（生楽はケアホーム併設なし。お泊まりがない場合は書類の該当箇所も確認）"],
      "通所_保険者名": ["多治見市", "※所在地の市。保険者の住所・電話・受付時間は要入力"]
    }
  };

  let pos = base.getIndex();
  OFFICES.forEach(function (o) {
    if (o.key === "naegi") return;
    pos++;
    if (ss.getSheetByName(o.sheet)) { log.push(o.sheet + "：作成済みのため変更なし"); return; }
    const sh = base.copyTo(ss).setName(o.sheet);
    ss.setActiveSheet(sh);
    ss.moveActiveSheet(pos);
    const d = Object.assign({}, kokuho, o.key === "seiraku" ? {} : day4, data[o.key] || {});
    const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
    const out = rows.map(function (r) {
      const tag = String(r[0]).trim();
      if (!tag) return [r[1], r[2]];
      if (d[tag]) return [d[tag][0] === SAME ? naegi[tag] : d[tag][0], d[tag][1]];
      const ref = naegi[tag];
      return ["", "※サイトに記載なし" + (ref ? "（苗木：" + ref + "）" : "")];
    });
    sh.getRange(2, 2, out.length, 2).setValues(out);
    log.push(o.sheet + "：作成");
  });

  const root = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  OFFICES.forEach(function (o) {
    if (!root.getFoldersByName(o.name).hasNext()) { root.createFolder(o.name); log.push("フォルダ作成：" + o.name); }
  });

  Logger.log("==事業所の追加v7==\n" + log.join("\n"));
}
