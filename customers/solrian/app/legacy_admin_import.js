/**
 * ============================================================
 * docxテンプレート取り込み機能 admin_import.gs
 * ============================================================
 *
 * 【できること】
 * 出力フォルダ（利用契約書）にドラッグした「◯◯_テンプレート.docx」を
 * まとめてGoogleドキュメントに変換し、「テンプレート（COCOiRO管理）」
 * タブのURL欄まで自動で登録します。変換済みのdocxは、フォルダ内の
 * 「_取込済docx」サブフォルダに移動します（再取り込み防止）。
 *
 * 【事前準備（1回だけ）】
 * Apps Script左メニューの「サービス」の＋を押し、
 * 「Drive API」を選んで追加してください（バージョンはv2のまま）。
 *
 * 【使い方】
 * 1. 利用契約書フォルダに docx をドラッグ＆ドロップ
 * 2. スプシのメニュー「🔧 管理用（COCOiRO）」→「docxテンプレートを取り込む」
 * 3. Webアプリを開き直すと書類発行タブに反映されます
 *
 * ※メニュー登録は doc_merge_v4_1.gs 側の onOpen に含まれています
 */

/** docxファイル名（拡張子・_テンプレート除く）→ テンプレートタブの出力名 */
const IMPORT_NAME_MAP = {
  "訪問_重要事項説明書": "訪問_重要事項説明書",
  "訪問_統一版": "訪問_重要事項説明書",
  "訪問_契約書": "訪問_契約書",
  "訪問_運営規程": "訪問_運営規程",
  "通所_重要事項説明書": "通所_重要事項説明書",
  "通所_統一版": "通所_重要事項説明書",
  "通所_契約書": "通所_契約書",
  "介護S_重要事項説明書": "介護S_重要事項説明書",
  "介護S_契約書": "介護S_契約書",
  "ホーム_重要事項説明書": "ホーム_重要事項説明書",
  "ホーム_契約書": "ホーム_入居契約書",
  "ホーム_管理規程": "ホーム_管理規程",
};

function importDocxTemplates() {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) {}
  var notify = function (msg) { if (ui) { ui.alert(msg); } else { Logger.log(msg); } };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_TEMPLATE);
  if (!sheet) { notify("テンプレートタブがありません。初期セットアップを実行してください。"); return; }

  var registered = {};
  var vals = sheet.getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    registered[String(vals[i][1] || "").trim()] = String(vals[i][0] || "").indexOf("http") === 0;
  }

  var folder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  var doneIt = folder.getFoldersByName("_取込済docx");
  var doneFolder = doneIt.hasNext() ? doneIt.next() : folder.createFolder("_取込済docx");

  var it = folder.getFiles();
  var out = [];
  var skipped = [];
  while (it.hasNext()) {
    var f = it.next();
    var name = f.getName();
    if (name.normalize) name = name.normalize("NFC"); // MacのNFDファイル名対策
    if (!/\.docx$/i.test(name)) continue;
    var baseName = name.replace(/\.docx$/i, "").replace(/_テンプレート$/, "");
    var outName = IMPORT_NAME_MAP[baseName];
    if (!outName) { skipped.push("対象外（タグなし等）: " + name); continue; }
    if (registered[outName]) { f.moveTo(doneFolder); skipped.push("登録済みのためスキップ: " + name); continue; }
    try {
      var newId = convertDocxToDoc_(f, baseName + "_テンプレート");
      var url = "https://docs.google.com/document/d/" + newId + "/edit";
      registerTemplateUrl_(outName, url);
      registered[outName] = true;
      f.moveTo(doneFolder);
      out.push("OK 取込: " + outName);
    } catch (e2) {
      skipped.push("NG " + name + " -> " + e2.message);
    }
  }

  if (!registered["訪問_契約書"]) {
    try {
      makeHoumonKeiyakuFromSource_();
      registered["訪問_契約書"] = true;
      out.push("OK 取込: 訪問_契約書（元ファイルからタグ再生成）");
    } catch (e3) {
      skipped.push("NG 訪問_契約書 -> " + e3.message);
    }
  }

  var status = [];
  var vals2 = sheet.getDataRange().getValues();
  for (var k = 1; k < vals2.length; k++) {
    var ok = String(vals2[k][0] || "").indexOf("http") === 0;
    status.push((ok ? "OK " : "未登録 ") + vals2[k][1]);
  }

  notify("==取込==\n" + (out.join("\n") || "なし") + "\n==スキップ==\n" + (skipped.join("\n") || "なし") + "\n==テンプレート登録状況==\n" + status.join("\n") + "\n\nWebアプリを開き直すと反映されます。");
}
/** テンプレートタブの該当行にURLを書き込む（該当行が無ければ追加） */
function registerTemplateUrl_(outName, url) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TEMPLATE);
  if (!sheet) throw new Error("「" + SHEET_TEMPLATE + "」タブがありません。初期セットアップを実行してください。");

  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (let i = 0; i < values.length; i++) {
      if (String(values[i][1]).trim() === outName) {
        sheet.getRange(i + 2, 1).setValue(url);
        return;
      }
    }
  }
  sheet.appendRow([url, outName]);
}



/** 訪問契約書テンプレを元docx（Drive上）から再生成：Docs変換→固有値をタグ化→登録 */
function makeHoumonKeiyakuFromSource_() {
  var SRC_ID = "1KR5N2ebGDsWSsgwA5Zy1tB3cwydUHLfA"; // 訪問介護・予防契約書.docx
  var src = DriveApp.getFileById(SRC_ID);
  var newId = convertDocxToDoc_(src, "訪問_契約書_テンプレート");
  var doc = DocumentApp.openById(newId);
  var pairs = [
    ["ケアステーションSteady", "{{訪問_事業所名}}"],
    ["株式会社Steady", "{{法人_名称}}"],
    ["可知　久美子", "{{法人_代表者名}}"],
    ["可知 久美子", "{{法人_代表者名}}"],
    ["岐阜県中津川市中津川2547-459", "{{法人_所在地}}"],
    ["岐阜県中津川市中津川２５４７－４５９", "{{法人_所在地}}"],
    ["高木　譲", "{{訪問_管理者名}}"],
    ["高木 譲", "{{訪問_管理者名}}"],
    ["1471907749", "{{訪問_事業所番号}}"],
    ["１４７１９０７７４９", "{{訪問_事業所番号}}"],
    ["046-839-2161", "{{訪問_電話}}"],
    ["０４６－８３９－２１６１", "{{訪問_電話}}"],
    ["046-839-2166", "{{訪問_FAX}}"],
    ["０４６－８３９－２１６６", "{{訪問_FAX}}"],
    ["神奈川県横須賀市津久井1丁目14-3", "{{訪問_所在地}}"],
    ["神奈川県横須賀市津久井１丁目１４－３", "{{訪問_所在地}}"]
  ];
  var sections = [doc.getBody(), doc.getHeader(), doc.getFooter()];
  for (var s = 0; s < sections.length; s++) {
    if (!sections[s]) continue;
    for (var p = 0; p < pairs.length; p++) {
      sections[s].replaceText(escapeRegex_(pairs[p][0]), pairs[p][1]);
    }
  }
  doc.saveAndClose();
  var url = "https://docs.google.com/document/d/" + newId + "/edit";
  registerTemplateUrl_("訪問_契約書", url);
  return url;
}

/** テンプレDocs等を「Steady_システム管理（COCOiRO）」へ退避（共有ドライブ対応版） */
function moveTemplatesToAdminFolder() {
  var DEST_ID = "1ZpWTHCyWPIVyRjxV3qooqhhiCmQoe--9"; // Steady_システム管理（COCOiRO）
  var out = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  var moved = [];
  var it = out.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var nm = f.getName();
    var isTemplateDoc = f.getMimeType() === MimeType.GOOGLE_DOCS && /_テンプレート$/.test(nm);
    var isDocx = /\.docx$/i.test(nm);
    var isMaster = nm === "Steady_マスター";
    if (!isTemplateDoc && !isDocx && !isMaster) continue;
    try {
      Drive.Files.update({}, f.getId(), null, {
        addParents: DEST_ID,
        removeParents: OUTPUT_FOLDER_ID,
        supportsAllDrives: true
      });
      moved.push("OK " + nm);
    } catch (e) {
      moved.push("NG " + nm + ": " + e.message);
    }
  }
  Logger.log("==退避完了v2==\n" + (moved.join("\n") || "移動対象なし"));
}

/** 退避先フォルダのテンプレDocsからテンプレート一覧タブを復旧（同名は新しい方を採用） */
function repairTemplateTab() {
  var ADMIN_ID = "1ZpWTHCyWPIVyRjxV3qooqhhiCmQoe--9"; // Steady_システム管理（COCOiRO）
  var folder = DriveApp.getFolderById(ADMIN_ID);
  var it = folder.getFilesByType(MimeType.GOOGLE_DOCS);
  var best = {};
  while (it.hasNext()) {
    var f = it.next();
    var nm = f.getName();
    if (!/_テンプレート$/.test(nm)) continue;
    var base = nm.replace(/_テンプレート$/, "");
    var outName = IMPORT_NAME_MAP[base];
    if (!outName) continue;
    var t = f.getDateCreated().getTime();
    if (!best[outName] || t > best[outName].t) best[outName] = { id: f.getId(), t: t };
  }
  var names = Object.keys(best);
  for (var i = 0; i < names.length; i++) {
    registerTemplateUrl_(names[i], "https://docs.google.com/document/d/" + best[names[i]].id + "/edit");
  }
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TEMPLATE);
  var vals = sheet.getDataRange().getValues();
  var status = [];
  for (var k = 1; k < vals.length; k++) {
    status.push((String(vals[k][0] || "").indexOf("http") === 0 ? "OK " : "未登録 ") + vals[k][1]);
  }
  Logger.log("==テンプレ復旧==\n登録" + names.length + "件: " + names.join(", ") + "\n==状況==\n" + status.join("\n"));
}

/** 既存テンプレに署名タグを一括挿入（新規2書類はタグ入りのため除外） */
function insertSignTags() {
  var targets = loadTemplates_().filter(function (t) {
    return t.outName !== "介護S_契約書" && t.outName !== "ホーム_重要事項説明書";
  });
  var report = [];
  targets.forEach(function (tpl) {
    try {
      var doc = DocumentApp.openById(extractDocId_(tpl.url));
      var body = doc.getBody();
      var edits = [];
      ["署名_利用者", "署名_代理人", "署名_続柄", "署名_日付", "説明者_氏名"].forEach(function (t) {
        body.replaceText("\\{\\{" + t + "\\}\\}", "");
      });
      var paras = body.getParagraphs();
      for (var i = 0; i < paras.length; i++) {
        var trimmed = paras[i].getText().replace(/[\s\u3000]/g, "");
        if (trimmed === "令和年月日") { paras[i].setText("{{署名_日付}}"); edits.push("日付"); }
      }
      var tables = body.getTables();
      for (var ti = 0; ti < tables.length; ti++) {
        var table = tables[ti];
        var context = "";
        for (var ri = 0; ri < table.getNumRows(); ri++) {
          var row = table.getRow(ri);
          var ncells = row.getNumCells();
          var first = ncells > 0 ? row.getCell(0).getText().replace(/[\s\u3000]/g, "") : "";
          if (first) context = first;
          for (var ci = 0; ci < ncells - 1; ci++) {
            var label = row.getCell(ci).getText().replace(/[\s\u3000]/g, "");
            var target = row.getCell(ci + 1);
            var tgtText = target.getText();
            if (tgtText.indexOf("{{") >= 0) continue;
            if (label === "氏名") {
              var hasStamp = tgtText.indexOf("㊞") >= 0;
              if (context.indexOf("代理人") >= 0 || context.indexOf("家族") >= 0) {
                setCellText_(target, "{{署名_代理人}}（続柄：{{署名_続柄}}）" + (hasStamp ? "　㊞" : ""));
                edits.push("代理人氏名");
              } else if (context.indexOf("利用者") >= 0 || context.indexOf("入居者") >= 0 || context === "甲") {
                setCellText_(target, "{{署名_利用者}}" + (hasStamp ? "　　　　　　　　㊞" : ""));
                edits.push("利用者氏名");
              }
            }
            if (label === "説明者名" || label === "説明者") {
              var hasStamp2 = tgtText.indexOf("㊞") >= 0;
              setCellText_(target, "{{説明者_氏名}}" + (hasStamp2 ? "　　　　　　　　㊞" : ""));
              edits.push("説明者");
            }
          }
        }
      }
      for (var t2 = 0; t2 < tables.length; t2++) {
        var tb = tables[t2];
        for (var r2 = 0; r2 < tb.getNumRows(); r2++) {
          for (var c2 = 0; c2 < tb.getRow(r2).getNumCells(); c2++) {
            var cell2 = tb.getRow(r2).getCell(c2);
            var tt = cell2.getText().replace(/[\s\u3000]/g, "");
            if (tt === "令和年月日") { setCellText_(cell2, "{{署名_日付}}"); edits.push("日付(表)"); }
          }
        }
      }
      doc.saveAndClose();
      report.push(tpl.outName + ": " + (edits.join(",") || "変更なし"));
    } catch (e) {
      report.push(tpl.outName + ": ERROR " + e.message);
    }
  });
  Logger.log("==署名タグ挿入==\n" + report.join("\n"));
}

/** 共有フォルダのテンプレ類・docx取込済フォルダを管理フォルダへ退避 */
function sweepOutputsToAdmin_() {
  var ADMIN_ID = "1ZpWTHCyWPIVyRjxV3qooqhhiCmQoe--9";
  var out = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  var moved = [];
  var files = out.getFiles();
  while (files.hasNext()) {
    var f = files.next();
    var nm = f.getName();
    if (nm.normalize) nm = nm.normalize("NFC");
    if (/_テンプレート(\.docx)?$/.test(nm) || /\.xlsx$/i.test(nm)) {
      Drive.Files.update({}, f.getId(), null, { addParents: ADMIN_ID, removeParents: OUTPUT_FOLDER_ID, supportsAllDrives: true });
      moved.push("file: " + nm);
    }
  }
  var folders = out.getFolders();
  while (folders.hasNext()) {
    var fo = folders.next();
    if (fo.getName() === "_取込済docx") {
      Drive.Files.update({}, fo.getId(), null, { addParents: ADMIN_ID, removeParents: OUTPUT_FOLDER_ID, supportsAllDrives: true });
      moved.push("folder: _取込済docx");
    }
  }
  Logger.log("==スイープ==\n" + (moved.join("\n") || "対象なし"));
}


/** 体裁調整済みブランクを新テンプレートに昇格 */
function promoteBlanksToTemplates() {
  var ADMIN_ID = "1ZpWTHCyWPIVyRjxV3qooqhhiCmQoe--9";
  var out = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  var fit = out.getFoldersByName("印刷用ブランク_20260805");
  if (!fit.hasNext()) { Logger.log("==昇格==\nブランクフォルダが見つかりません"); return; }
  var blankFolder = fit.next();
  var adminFolder = DriveApp.getFolderById(ADMIN_ID);
  var master = loadMaster_();
  var valueMap = {};
  Object.keys(master).forEach(function (tag) {
    var val = String(master[tag] || "").trim();
    if (!val) return;
    if (!valueMap[val]) valueMap[val] = [];
    valueMap[val].push(tag);
  });
  var values = Object.keys(valueMap).sort(function (a, b) { return b.length - a.length; });
  var skippedValues = [];
  var report = [];
  var it = blankFolder.getFilesByType(MimeType.GOOGLE_DOCS);
  while (it.hasNext()) {
    var bf = it.next();
    var bn = bf.getName();
    if (bn.normalize) bn = bn.normalize("NFC");
    if (!/_ブランク$/.test(bn)) continue;
    var outName = bn.replace(/_ブランク$/, "");
    try {
      var prefixes = pickPrefixes_(outName);
      var copy = bf.makeCopy(outName + "_テンプレート", adminFolder);
      var doc = DocumentApp.openById(copy.getId());
      var body = doc.getBody();
      var nRev = 0;
      values.forEach(function (val) {
        if (val.length < 4 || /^[0-9０-９.,、．，%％]+$/.test(val)) {
          if (skippedValues.indexOf(val) < 0) skippedValues.push(val);
          return;
        }
        var tag = pickTag_(valueMap[val], prefixes);
        if (body.findText(escapeRegex_(val))) {
          body.replaceText(escapeRegex_(val), "{{" + tag + "}}");
          nRev++;
        }
      });
      var nSign = applySignTagsToDoc_(doc, outName);
      doc.saveAndClose();
      registerTemplateUrl_(outName, "https://docs.google.com/document/d/" + copy.getId() + "/edit");
      var pdfName = outName + "_ブランク.pdf";
      var oldPdfs = blankFolder.getFilesByName(pdfName);
      while (oldPdfs.hasNext()) oldPdfs.next().setTrashed(true);
      blankFolder.createFile(bf.getAs("application/pdf").setName(pdfName));
      report.push("OK " + outName + "（逆変換" + nRev + "件・署名系" + nSign + "件）");
    } catch (e) {
      report.push("NG " + outName + ": " + e.message);
    }
  }
  Logger.log("==昇格==\n" + report.join("\n") + "\n==逆変換スキップ（数値等・要目視）==\n" + (skippedValues.join(" / ") || "なし"));
}

function pickPrefixes_(outName) {
  if (outName.indexOf("訪問_") === 0) return ["訪問_", "法人_"];
  if (outName.indexOf("通所_") === 0) return ["通所_", "法人_"];
  if (outName.indexOf("介護S_") === 0) return ["介護S_", "通所_", "法人_"];
  if (outName.indexOf("ホーム_") === 0) return ["ホーム_", "法人_"];
  return ["法人_"];
}

function pickTag_(tags, prefixes) {
  for (var i = 0; i < prefixes.length; i++) {
    for (var j = 0; j < tags.length; j++) {
      if (tags[j].indexOf(prefixes[i]) === 0) return tags[j];
    }
  }
  return tags[0];
}

/** 署名・説明者・日付・利用者タグをドキュメントへ挿入（昇格用） */
function applySignTagsToDoc_(doc, outName) {
  var body = doc.getBody();
  var n = 0;
  var paras = body.getParagraphs();
  for (var i = 0; i < paras.length; i++) {
    var t = paras[i].getText();
    var s = t.replace(/[\s\u3000]/g, "");
    if (s === "令和年月日") { paras[i].setText("{{署名_日付}}"); n++; }
    if (outName === "訪問_契約書") {
      if (s === "契約締結日令和年月日" || s === "契約締結日年月日") { paras[i].setText("契約締結日　　{{署名_日付}}"); n++; }
      if (s === "説明者") { paras[i].setText("説明者　　　{{説明者_氏名}}"); n++; }
    }
  }
  if (outName === "訪問_契約書") {
    var ctx = "";
    paras = body.getParagraphs();
    for (var k = 0; k < paras.length; k++) {
      var tt = paras[k].getText();
      var ss = tt.replace(/[\s\u3000]/g, "");
      if (ss === "利用者") ctx = "利用者";
      if (ss.indexOf("家族") === 0 || ss.indexOf("代理人") >= 0) ctx = "代理人";
      var core = ss.replace(/㊞/g, "").replace(/（続柄：）/g, "");
      if (core === "氏名" && ss.indexOf("{{") < 0) {
        var stp = tt.indexOf("㊞") >= 0 ? "　　㊞" : "";
        if (ctx === "利用者") { paras[k].setText("氏　名　　　{{署名_利用者}}" + stp); ctx = ""; n++; }
        else if (ctx === "代理人") { paras[k].setText("氏　名　　　{{署名_代理人}}（続柄：{{署名_続柄}}）" + stp); ctx = ""; n++; }
      }
    }
  }
  var tables = body.getTables();
  for (var ti = 0; ti < tables.length; ti++) {
    var table = tables[ti];
    var context = "";
    for (var ri = 0; ri < table.getNumRows(); ri++) {
      var row = table.getRow(ri);
      var ncells = row.getNumCells();
      var first = ncells > 0 ? row.getCell(0).getText().replace(/[\s\u3000]/g, "") : "";
      if (first) context = first;
      for (var ci = 0; ci < ncells; ci++) {
        var cell = row.getCell(ci);
        var cellTrim = cell.getText().replace(/[\s\u3000]/g, "");
        if (cellTrim === "令和年月日" && first.indexOf("入居予定日") < 0) { setCellText_(cell, "{{署名_日付}}"); n++; continue; }
        if (ci >= ncells - 1) continue;
        var target = row.getCell(ci + 1);
        var tgtText = target.getText();
        if (tgtText.indexOf("{{") >= 0) continue;
        var tgtTrim = tgtText.replace(/[\s\u3000]/g, "");
        if (cellTrim === "氏名") {
          var hasStamp = tgtText.indexOf("㊞") >= 0;
          if (context.indexOf("代理人") >= 0 || context.indexOf("家族") >= 0) {
            setCellText_(target, "{{署名_代理人}}（続柄：{{署名_続柄}}）" + (hasStamp ? "　㊞" : "")); n++;
          } else if (context.indexOf("利用者") >= 0 || context.indexOf("入居者") >= 0 || context === "甲" || context.indexOf("説明を受けた") >= 0) {
            setCellText_(target, "{{署名_利用者}}" + (hasStamp ? "　　　　　　　　㊞" : "")); n++;
          }
        }
        if ((cellTrim === "説明者名" || cellTrim === "説明者") && tgtTrim.replace(/㊞/g, "") === "") {
          var hs2 = tgtText.indexOf("㊞") >= 0;
          setCellText_(target, "{{説明者_氏名}}" + (hs2 ? "　　　　　　　　㊞" : "")); n++;
        }
        if (cellTrim === "記入年月日" && tgtTrim === "") { setCellText_(target, "{{契約日}}"); n++; }
      }
    }
  }
  if (outName === "ホーム_入居契約書") {
    if (body.replaceText("入居者①[\\s　]*氏名：", "入居者①　氏名：{{署名_利用者}}　")) n++;
  }
  if (outName === "介護S_契約書") {
    if (body.replaceText("利用者[ 　]*（以下「甲」", "利用者 {{利用者_氏名}}（以下「甲」")) n++;
  }
  return n;
}


function verifyTemplateTags_() {
  var lines = [];
  loadTemplates_().forEach(function (tpl) {
    var txt = DocumentApp.openById(extractDocId_(tpl.url)).getBody().getText();
    var tags = txt.match(/\{\{[^}]+\}\}/g) || [];
    var uniq = {};
    tags.forEach(function (t) { uniq[t] = (uniq[t] || 0) + 1; });
    lines.push(tpl.outName + ": " + Object.keys(uniq).join(" "));
  });
  Logger.log("==タグ検証==\n" + lines.join("\n"));
}
