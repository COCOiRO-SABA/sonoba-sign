/**
 * ============================================================
 * 書類一括生成スクリプト v4.2
 * ============================================================
 *
 * 【v4.1からの変更点】
 * ・スプシのセルが日付型でも「yyyy年M月d日」で正しく書類に入るよう修正
 * ・メニューをサービス別に分割（訪問／通所／ホーム／介護S／すべて）
 * ・実行時に利用者名を質問 → 「年月日_利用者名」フォルダにまとめて格納
 * ・書類内に {{利用者_氏名}}{{契約日}} タグがあれば自動で反映
 */

// ================= 設定 =================
const OUTPUT_FOLDER_ID = PropertiesService.getScriptProperties().getProperty("OUTPUT_FOLDER_ID") || ""; // 出力先フォルダ（10.そのばサイン／利用契約書）。スクリプトプロパティ
const SHEET_GUIDE = "🏠 使い方";
const SHEET_TEMPLATE = "テンプレート（COCOiRO管理）";

// 事業所の一覧（OFFICES・DEFAULT_OFFICE・MASTER_SHEETS）は会社ごとの設定ファイル（config.js）にある
function getOffice_(key) {
  return OFFICES.filter(function (o) { return o.key === key; })[0]
    || OFFICES.filter(function (o) { return o.key === DEFAULT_OFFICE; })[0];
}

/**
 * マスタータブの見出し行の次(データの始まり)を0始まりで返す。
 * 「タグ名」で始まる行があればその次の行から。なければ2行目から(1行目が見出し)
 * 2026-11-27 COCOiRO：見出しの上に説明行がある会社(らふたす)も同じコードで読めるようにした
 */
function masterDataStart_(values) {
  for (let i = 0; i < Math.min(values.length, 10); i++) {
    if (String(values[i][0] || "").trim().indexOf("タグ名") === 0) return i + 1;
  }
  return 1;
}

/** その事業所で使うマスタータブ（法人共通＋事業所） */
function masterSheetsFor_(officeKey) {
  const o = getOffice_(officeKey);
  return [MASTER_SHEETS[0], { name: o.sheet, color: "#188038", label: o.name }];
}

const ZENKAKU_SYMBOL_MAP = {
  "-": "－", ":": "：", "%": "％", "~": "～",
  "(": "（", ")": "）", "/": "／", ".": "．", ",": "，", " ": "　"
};

// ================= メニュー =================
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  if (CONFIG.simpleMenu) { // 2026-11-27 COCOiRO：書類はWebアプリだけでつくる会社
    ui.createMenu("そのばサイン").addItem("Webアプリを開く", "showAppUrl_").addToUi();
    return;
  }
  ui.createMenu("📄 書類をつくる")
    .addItem("すべてのサービスの書類を作成", "generateAll")
    .addSeparator()
    .addItem("デイサービスの書類を作成", "generateTsusho")
    .addItem("介護サポート（保険外）の書類を作成", "generateKaigoS")
    .addSeparator()
    .addItem("印刷用ブランク一式を作成（利用者名なし）", "generatePrintBlanks")
    .addToUi();
  ui.createMenu("🔧 管理用（COCOiRO）")
    .addItem("初期セットアップ（最初に1回）", "setupSpreadsheet")
    .addItem("docxテンプレートを取り込む", "importDocxTemplates")
    .addItem("登録タグの一覧を確認", "listTags")
    .addToUi();
}

function showAppUrl_() {
  const url = ScriptApp.getService().getUrl();
  const html = url
    ? '<p style="font-family:sans-serif">下のリンクから開いてください。</p><p><a href="' + url + '" target="_blank">そのばサインを開く</a></p>'
    : '<p style="font-family:sans-serif">まだデプロイされていません。COCOiROに連絡してください。</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(360).setHeight(140), "そのばサイン");
}

// ================= 書類生成まわり =================

/** 半角の数字・記号を全角に変換（アルファベットは変換しない） */
function toZenkaku_(text) {
  return String(text)
    .replace(/[0-9]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) + 0xFEE0);
    })
    .replace(/[-:%~()\/.,]/g, function (ch) {
      return ZENKAKU_SYMBOL_MAP[ch] || ch;
    });
}

/** セル値を文字列化（日付セルは「yyyy年M月d日」に整形） */
function masterValueToString_(v) {
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return Utilities.formatDate(v, "Asia/Tokyo", "yyyy年M月d日");
  }
  return v === null || v === undefined ? "" : String(v);
}

/** Dateを令和表記に（例：令和8年8月2日） */
function toWareki_(d) {
  const reiwa = d.getFullYear() - 2018;
  return "令和" + reiwa + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

/** マスタータブを統合して {タグ名: 全角変換済みの値} を返す */
function loadMaster_(officeKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const master = {};
  masterSheetsFor_(officeKey).forEach(function (def) {
    const sheet = ss.getSheetByName(def.name);
    if (!sheet) return;
    const values = sheet.getDataRange().getValues();
    const start = masterDataStart_(values);
    values.forEach(function (row, i) {
      if (i < start) return;
      const tag = String(row[0] || "").trim();
      if (!tag) return;
      master[tag] = toZenkaku_(masterValueToString_(row[1]));
    });
  });
  // 2026-10-21 COCOiRO：Webアプリ以外の経路でもタグが残らないよう既定値を用意
  if (!("利用者_住所" in master)) master["利用者_住所"] = "";
  if (!("利用者_郵便番号" in master)) master["利用者_郵便番号"] = "";
  return master;
}

/**
 * テンプレートタブから [{url, outName}] を返す
 * ・A列URL／B列書類名 の形(Solrianなど)と、A列書類名／B列URL の形(らふたす)のどちらも読む
 */
function loadTemplates_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TEMPLATE);
  if (!sheet) throw new Error("「" + SHEET_TEMPLATE + "」タブが見つかりません。管理用メニューから初期セットアップを実行してください。");
  const values = sheet.getDataRange().getValues();
  const list = [];
  values.forEach(function (row) {
    const cells = row.map(function (v) { return String(v || "").trim(); });
    const u = cells.findIndex(function (v) { return v.indexOf("http") === 0; });
    if (u < 0) return;
    const outName = u === 0 ? cells[1] : cells[u - 1];
    list.push({ url: cells[u], outName: outName || "生成書類" });
  });
  return list;
}

function extractDocId_(url) {
  const match = url.match(/[-\w]{25,}/);
  if (!match) throw new Error("ドキュメントIDを取得できませんでした: " + url);
  return match[0];
}

function todayStamp_() {
  return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd");
}

// ---- メニュー用エントリ ----
function generateAll()    { generateForService_(null, "すべてのサービス"); }
function generateHoumon() { generateForService_("訪問_", "訪問介護"); }
function generateTsusho() { generateForService_("通所_", "デイサービス"); }
function generateHome()   { generateForService_("ホーム_", "有料老人ホーム"); }
function generateKaigoS() { generateForService_("介護S_", "介護サポート（保険外）"); }

// 旧メニューとの互換用
function generateAllDocuments() { generateAll(); }

/** メイン：利用者名を質問→「年月日_利用者名」フォルダに指定サービスの書類を生成 */
function generateForService_(prefix, serviceLabel) {
  const ui = SpreadsheetApp.getUi();

  const res = ui.prompt(
    serviceLabel + " の書類を作成",
    "利用者様のお名前を入力してください。\n（フォルダ名になり、書類内の利用者名欄にも入ります）",
    ui.ButtonSet.OK_CANCEL
  );
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const clientName = String(res.getResponseText() || "").trim();
  if (!clientName) {
    ui.alert("お名前が入力されていません。もう一度やり直してください。");
    return;
  }

  // 説明者名（重要事項説明書等の説明者欄に印字されます）
  const res2 = ui.prompt(
    serviceLabel + " の書類を作成",
    "説明するスタッフのお名前を入力してください。\n（書類の説明者欄に入ります。空欄でもOK）",
    ui.ButtonSet.OK_CANCEL
  );
  if (res2.getSelectedButton() !== ui.Button.OK) return;
  const explainerName = String(res2.getResponseText() || "").trim();

  const master = loadMaster_();
  if (Object.keys(master).length === 0) {
    ui.alert("マスターに値がありません。管理用メニューから初期セットアップを実行してください。");
    return;
  }
  master["利用者_氏名"] = clientName;
  master["契約日"] = toZenkaku_(toWareki_(new Date()));
  master["説明者_氏名"] = explainerName;

  let templates = loadTemplates_();
  if (prefix) templates = templates.filter(function (t) { return t.outName.indexOf(prefix) === 0; });
  if (templates.length === 0) {
    ui.alert(serviceLabel + " の書類テンプレートが見つかりません。\n「" + SHEET_TEMPLATE + "」タブを確認してください。");
    return;
  }

  const stamp = todayStamp_();
  const parent = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  const folderName = stamp + "_" + clientName;
  const fit = parent.getFoldersByName(folderName);
  const folder = fit.hasNext() ? fit.next() : parent.createFolder(folderName);

  const tagNames = Object.keys(master);
  const results = [];
  const errors = [];

  templates.forEach(function (tpl) {
    try {
      const srcId = extractDocId_(tpl.url);
      const srcFile = DriveApp.getFileById(srcId);
      const newName = tpl.outName + "_" + clientName + "_" + stamp;
      const copy = srcFile.makeCopy(newName, folder);
      const doc = DocumentApp.openById(copy.getId());

      [doc.getBody(), doc.getHeader(), doc.getFooter()].forEach(function (section) {
        if (!section) return;
        tagNames.forEach(function (tag) {
          section.replaceText(escapeRegex_("{{" + tag + "}}"), master[tag]);
        });
        section.replaceText("㋞", ""); // 電子サイン運用では印マーク不要
      });

      const remaining = (doc.getBody().getText().match(/\{\{[^}]+\}\}/g) || []).filter(function (t) { return t.indexOf("{{署名_") !== 0; }); // 署名タグは署名時に入るため警告対象外
      doc.saveAndClose();

      let line = "✅ " + newName;
      if (remaining && remaining.length > 0) {
        const uniq = remaining.filter(function (v, i, a) { return a.indexOf(v) === i; });
        line += "\n　⚠ 埋まらなかった箇所: " + uniq.join(", ");
      }
      results.push(line);
    } catch (e) {
      errors.push("❌ " + tpl.outName + " → " + e.message);
    }
  });

  let message = "書類ができました（" + results.length + "件）。\n保存先フォルダ：" + folderName + "\n\n" + results.join("\n");
  if (errors.length > 0) {
    message += "\n\n作成できなかったもの：\n" + errors.join("\n") + "\n\nCOCOiROまでご連絡ください。";
  }
  ui.alert(message);
}

function escapeRegex_(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** デバッグ用：登録タグ一覧をログに表示 */
function listTags() {
  const master = loadMaster_();
  const list = Object.keys(master).map(function (k) { return "{{" + k + "}} → " + master[k]; }).join("\n");
  Logger.log(list);
  SpreadsheetApp.getUi().alert("実行ログ（表示 > ログ）にタグ一覧を出力しました。");
}

// ================= 初期セットアップ =================

/** 初期セットアップ：タブ作成＋データ投入＋デザイン適用 */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const data = typeof initialMasterData_ === "function" ? initialMasterData_() : {};

  const guide = getOrCreateSheet_(ss, SHEET_GUIDE, 0);
  guide.clear();
  guide.setTabColor("#fbbc04");
  guide.setColumnWidth(1, 40);
  guide.setColumnWidth(2, 760);
  const rows = [
    ["", ""],
    ["", CONFIG.guideTitle],
    ["", ""],
    ["", "① 下の色つきタブを開き、黄色いセル（値）だけを直します"],
    ["", "　　例）管理者が交代した → 「通所_管理者名」の黄色いセルを書き換える"],
    ["", "② 上のメニュー「📄 書類をつくる」からサービスを選びます"],
    ["", "③ 利用者様のお名前を入力すると「年月日_お名前」フォルダに書類ができます"],
    ["", ""],
    ["", "・タグ名（左の列）と灰色のタブは変更しないでください"],
    ["", "・数字や記号は半角で入力してOK。書類にする時に自動で全角になります"],
    ["", "・困ったときは COCOiRO までご連絡ください"]
  ];
  guide.getRange(1, 1, rows.length, 2).setValues(rows);
  guide.getRange(2, 2).setFontSize(20).setFontWeight("bold").setFontColor("#1a73e8");
  guide.getRange(4, 2, 4, 1).setFontSize(13);
  guide.getRange(9, 2, 3, 1).setFontSize(11).setFontColor("#5f6368");
  guide.setHiddenGridlines(true);

  MASTER_SHEETS.forEach(function (def, idx) {
    const sheet = getOrCreateSheet_(ss, def.name, idx + 1);
    const isNew = sheet.getLastRow() === 0;
    if (isNew) {
      const values = [["タグ名（触らない）", "値（ここを直す）", "メモ"]].concat(data[def.name] || []);
      sheet.getRange(1, 1, values.length, 3).setValues(values);
    }
    styleMasterSheet_(sheet, def);
  });

  const tpl = getOrCreateSheet_(ss, SHEET_TEMPLATE, MASTER_SHEETS.length + 1);
  if (tpl.getLastRow() === 0) {
    const values = [["テンプレートDocsのURL", "出力ファイル名"]].concat(typeof initialTemplateData_ === "function" ? initialTemplateData_() : []);
    tpl.getRange(1, 1, values.length, 2).setValues(values);
  }
  tpl.setTabColor("#9e9e9e");
  tpl.setColumnWidth(1, 560);
  tpl.setColumnWidth(2, 220);
  tpl.getRange(1, 1, 1, 2).setBackground("#616161").setFontColor("#ffffff").setFontWeight("bold");
  tpl.setFrozenRows(1);
  protectWarn_(tpl.getRange("A:B"), "このタブはCOCOiROが管理しています。変更するとお知らせが出ます。");

  ss.setActiveSheet(guide);
  SpreadsheetApp.getUi().alert("セットアップが完了しました。");
}

/** マスタータブのデザイン適用 */
function styleMasterSheet_(sheet, def) {
  const lastRow = Math.max(sheet.getLastRow(), 2);
  sheet.setTabColor(def.color);
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 360);
  sheet.setColumnWidth(3, 380);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 3).setBackground(def.color).setFontColor("#ffffff").setFontWeight("bold").setVerticalAlignment("middle");
  sheet.setRowHeight(1, 34);
  sheet.getRange(2, 1, lastRow - 1, 1).setBackground("#f1f3f4").setFontColor("#5f6368");
  sheet.getRange(2, 2, lastRow - 1, 1).setBackground("#fff8c5");
  sheet.getRange(2, 3, lastRow - 1, 1).setFontColor("#80868b").setFontSize(9);
  sheet.getRange(2, 1, lastRow - 1, 3).setVerticalAlignment("middle");
  for (let r = 2; r <= lastRow; r++) sheet.setRowHeight(r, 28);
  sheet.getRange(1, 1, lastRow, 3).setBorder(true, true, true, true, true, true, "#dadce0", SpreadsheetApp.BorderStyle.SOLID);
  protectWarn_(sheet.getRange(2, 1, lastRow - 1, 1), "タグ名は書類と対応しています。変更しないでください。");
}

/** 警告つき保護（編集はできるが警告が出る） */
function protectWarn_(range, description) {
  const sheet = range.getSheet();
  sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) {
    if (p.getDescription() === description) p.remove();
  });
  range.protect().setDescription(description).setWarningOnly(true);
}

/** タブを取得（無ければ作成し、指定位置へ移動） */
function getOrCreateSheet_(ss, name, index) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name, index);
  return sheet;
}


/** 印刷用ブランク一式：事業所情報のみ反映し、利用者名・契約日・署名欄は空欄のDocs＋PDFを作成 */
function generatePrintBlanks() {
  var master = loadMaster_();
  master["利用者_氏名"] = "";
  master["契約日"] = "";
  var templates = loadTemplates_();
  var parent = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  var folderName = "印刷用ブランク_" + todayStamp_();
  var fit = parent.getFoldersByName(folderName);
  var folder = fit.hasNext() ? fit.next() : parent.createFolder(folderName);
  var tagNames = Object.keys(master);
  var out = [];
  templates.forEach(function (tpl) {
    try {
      var srcFile = DriveApp.getFileById(extractDocId_(tpl.url));
      var copy = srcFile.makeCopy(tpl.outName + "_ブランク", folder);
      var doc = DocumentApp.openById(copy.getId());
      [doc.getBody(), doc.getHeader(), doc.getFooter()].forEach(function (section) {
        if (!section) return;
        tagNames.forEach(function (tag) {
          section.replaceText(escapeRegex_("{{" + tag + "}}"), master[tag]);
        });
        section.replaceText(escapeRegex_("{{署名_日付}}"), "令和　　　年　　　月　　　日");
        section.replaceText(escapeRegex_("{{署名_続柄}}"), "　　　　");
        section.replaceText("\\{\\{署名_[^}]+\\}\\}", "");
        section.replaceText(escapeRegex_("{{説明者_氏名}}"), "");
// 2026-11-04 COCOiRO：v6で増えたタグを印刷用ブランクでは空欄・元の表記に戻す
section.replaceText(escapeRegex_("{{利用開始日}}"), "令和　　年　　月　　日");
section.replaceText(escapeRegex_("{{代理人_住所}}"), "");
section.replaceText(escapeRegex_("{{利用者_住所}}"), "");
section.replaceText("\\{\\{同意_[0-9]+\\}\\}", "する ・ しない");
section.replaceText("\\{\\{写真_[0-9]+\\}\\} ?", "");
      });
      doc.saveAndClose();
      var pdf = copy.getAs("application/pdf").setName(tpl.outName + "_ブランク.pdf");
      folder.createFile(pdf);
      out.push("OK " + tpl.outName);
    } catch (e) {
      out.push("NG " + tpl.outName + ": " + e.message);
    }
  });
  var msg = "==ブランク作成==\n" + out.join("\n") + "\nフォルダ: " + folderName;
  try { SpreadsheetApp.getUi().alert(msg.replace(/\\n/g, "\n")); } catch (e2) { Logger.log(msg); }
}


