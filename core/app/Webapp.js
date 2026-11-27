/**
 * ============================================================
 * 契約書類Webアプリ（プロトタイプ） webapp.gs
 * ============================================================
 *
 * 【前提】
 * doc_merge_v4.gs と同じApps Scriptプロジェクトに、このファイルと
 * index.html を追加してください（OUTPUT_FOLDER_ID等の設定を共用します）。
 *
 * 【デプロイ手順】
 * 1. Apps Script画面 右上「デプロイ」→「新しいデプロイ」
 * 2. 種類：ウェブアプリ
 *    - 実行ユーザー：自分（COCOiROアカウント）
 *    - アクセスできるユーザー：組織内の全員（お客さんのドメインに合わせる）
 * 3. 発行されたURLをタブレットのホーム画面に追加
 *
 * 【画面構成】
 * ① 事業所情報：マスタータブの値をフォームで編集
 * ② 書類発行　：利用者名＋契約日を入れて書類一式を利用者フォルダに発行
 * ③ サイン　　：発行済み書類を選び、タブレットに手書きサイン
 *              → 署名ページを付けたPDFを利用者フォルダに保存
 */

// ================= Webアプリ入口 =================
function doGet(e) {
  // 2026-11-04 COCOiRO v7：リンクの ?office= で事業所を切り替える
  const office = getOffice_(e && e.parameter ? e.parameter.office : "");
  const t = HtmlService.createTemplateFromFile("index");
  t.officeKey = office.key;
  t.officeName = office.name;
  t.headerNote = CONFIG.headerNote;
  return t.evaluate()
    .setTitle("そのばサイン｜" + office.short)
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1");
}

// ================= 画面初期データ =================
function getInitData(officeKey) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masters = masterSheetsFor_(officeKey).map((def) => {
    const sheet = ss.getSheetByName(def.name);
    const rows = [];
    if (sheet && sheet.getLastRow() > 1) {
      sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues().forEach((r) => {
        if (String(r[0]).trim()) rows.push({ tag: String(r[0]), value: masterValueToString_(r[1]), note: String(r[2] || "") });
      });
    }
    return { name: def.name, label: def.label, color: def.color, rows: rows };
  });

  const templates = loadTemplates_().map((t, i) => ({ index: i, outName: t.outName }));
  return { masters: masters, templates: templates, clients: listClients_(officeKey), consentItems: CONSENT_ITEMS, photoChoices: PHOTO_CHOICES };
}

/** 利用者フォルダの一覧（事業所ごと。利用者名順） */
function listClients_(officeKey) {
  const skip = OFFICES.map(function (o) { return o.name; });
  const names = [];
  clientParents_(officeKey).forEach(function (folder) {
    const it = folder.getFolders();
    while (it.hasNext()) {
      const nm = it.next().getName();
      if (nm.indexOf("_") === 0 || nm.indexOf("印刷用ブランク") === 0 || skip.indexOf(nm) >= 0) continue;
      if (names.indexOf(nm) < 0) names.push(nm);
    }
  });
  return names.sort(function (a, b) { return a.localeCompare(b, "ja"); });
}

// ================= ① 事業所情報の保存 =================
function saveMaster(sheetName, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("タブが見つかりません: " + sheetName);
  const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2);
  const current = range.getValues();
  const map = {};
  rows.forEach((r) => (map[r.tag] = r.value));
  let updated = 0;
  current.forEach((row) => {
    const tag = String(row[0]).trim();
    if (tag && map.hasOwnProperty(tag) && String(row[1]) !== String(map[tag])) {
      row[1] = map[tag];
      updated++;
    }
  });
  range.setValues(current);
  return { updated: updated };
}

// ================= ② 書類発行 =================
// 2026-11-04 COCOiRO：利用者・家族は「日付を選んでサインするだけ」にするため、
// サインする人（本人／代理人）・代理人の情報・同意書の選択・利用開始日を、発行時に職員が入れる

function generateForClient(form) {
  form = form || {};
  const clientName = String(form.clientName || "").trim();
  if (!clientName) throw new Error("利用者名を入力してください。");
  const clientAddr = String(form.clientAddr || "").trim();
  if (!clientAddr) throw new Error("利用者の住所を入力してください。");
  const signer = form.signer === "代理人" ? "代理人" : "本人";
  const agentName = String(form.agentName || "").trim();
  const agentRelation = String(form.agentRelation || "").trim();
  const agentAddr = String(form.agentAddr || "").trim();
  if (signer === "代理人" && (!agentName || !agentRelation || !agentAddr)) {
    throw new Error("代理人のお名前・続柄・住所を入力してください。");
  }

  const office = getOffice_(form.office);
  const master = loadMaster_(office.key);
  master["利用者_氏名"] = clientName;
  master["契約日"] = form.contractDate ? formatJapaneseDate_(form.contractDate) : toZenkaku_(toWareki_(new Date()));
  master["利用開始日"] = form.startDate ? formatJapaneseDate_(form.startDate) : master["契約日"];
  master["説明者_氏名"] = String(form.explainerName || "").trim();
  const explainMethod = String(form.explainMethod || "").trim(); // 2026-11-26 COCOiRO v10：説明方法
  master["説明方法"] = toZenkaku_(explainMethod);

  const zipDigits = String(form.clientZip || "").replace(/[^0-9]/g, "");
  master["利用者_郵便番号"] = zipDigits.length === 7
    ? toZenkaku_(zipDigits.slice(0, 3) + "-" + zipDigits.slice(3))
    : toZenkaku_(String(form.clientZip || "").trim());
  master["利用者_住所"] = toZenkaku_(clientAddr);
  master["代理人_住所"] = signer === "代理人" ? toZenkaku_(agentAddr) : "";

  // 個人情報同意書の選択（■／□で印字）
  const consents = Array.isArray(form.consents) ? form.consents : [];
  CONSENT_ITEMS.forEach(function (_, i) {
    master["同意_" + (i + 1)] = consents[i] === false ? "□する　■しない" : "■する　□しない";
  });
  const photo = Number(form.photo) || 0;
  PHOTO_CHOICES.forEach(function (_, i) {
    master["写真_" + (i + 1)] = i === photo ? "■" : "□";
  });

  // 署名欄：サインしない側は発行時に埋める。サイン時に入るのはサイン画像と署名日だけ
  if (signer === "代理人") {
    master["署名_利用者"] = clientName;
    master["署名_続柄"] = toZenkaku_(agentRelation);
  }

  const templates = loadTemplates_();
  const selected = form.selected;
  const targets = (selected && selected.length > 0)
    ? selected.map((i) => templates[i]).filter(Boolean)
    : templates;

  const clientFolder = getOrCreateClientFolder_(office.key, clientName + "_" + todayStamp_()); // 利用者名_日付
  const docFolder = getOrCreateSubFolder_(clientFolder, SUBFOLDER_DOCS);
  getOrCreateSubFolder_(clientFolder, SUBFOLDER_PDFS); // 置き場所が分かるよう空でも先に作る
  // サイン画面で「サインする人」を出すため、フォルダの説明欄に保存する
  clientFolder.setDescription(JSON.stringify({
    office: office.key, clientName: clientName, signer: signer, agentName: agentName, agentRelation: agentRelation,
    explainMethod: explainMethod, explainerName: String(form.explainerName || "").trim()
  }));

  const tagNames = Object.keys(master);
  const stamp = todayStamp_();
  const files = [];
  const errors = [];

  targets.forEach((tpl) => {
    try {
      const newName = tpl.outName + "_" + clientName + "_" + stamp;
      // 同じ日に発行し直したときは、前のサイン前の書類をゴミ箱へ（重複してサイン対象にならないように）
      const old = docFolder.getFilesByName(newName);
      while (old.hasNext()) old.next().setTrashed(true);

      const srcFile = DriveApp.getFileById(extractDocId_(tpl.url));
      const copy = srcFile.makeCopy(newName, docFolder);
      const doc = DocumentApp.openById(copy.getId());
      [doc.getBody(), doc.getHeader(), doc.getFooter()].forEach((section) => {
        if (!section) return;
        if (signer === "本人") {
          // 本人がサインするときは、代理人の氏名・続柄の欄を空ける
          section.replaceText("\\{\\{署名_代理人\\}\\}（続柄：\\{\\{署名_続柄\\}\\}）", "");
          section.replaceText(escapeRegex_("{{署名_代理人}}"), "");
          section.replaceText(escapeRegex_("{{署名_続柄}}"), "");
        }
        tagNames.forEach((tag) => {
          section.replaceText(escapeRegex_("{{" + tag + "}}"), master[tag]);
        });
        section.replaceText("㋞", ""); // 電子サイン運用では印マーク不要
        section.replaceText("㊞", ""); // 別字体の印マークも削除
      });
      doc.saveAndClose();
      files.push({ name: newName, url: copy.getUrl() });
    } catch (e) {
      errors.push(tpl.outName + "：" + e.message);
    }
  });

  return { folderUrl: clientFolder.getUrl(), files: files, errors: errors };
}

/** 事業所の利用者フォルダの置き場所（利用契約書／事業所名） */
function getOfficeFolder_(officeKey) {
  const office = getOffice_(officeKey);
  const root = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  const it = root.getFoldersByName(office.name);
  return it.hasNext() ? it.next() : root.createFolder(office.name);
}

/** 利用者フォルダを探す場所。苗木は v6 までの置き場所（利用契約書の直下）も見る */
function clientParents_(officeKey) {
  const office = getOffice_(officeKey);
  const list = [getOfficeFolder_(office.key)];
  if (office.key === DEFAULT_OFFICE) list.push(DriveApp.getFolderById(OUTPUT_FOLDER_ID));
  return list;
}

function getOrCreateClientFolder_(officeKey, clientName) {
  const parents = clientParents_(officeKey);
  for (let i = 0; i < parents.length; i++) {
    const it = parents[i].getFoldersByName(clientName);
    if (it.hasNext()) return it.next();
  }
  return parents[0].createFolder(clientName);
}

// 2026-10-22 COCOiRO：利用者フォルダの中を「サイン前の書類」と「サイン済みPDF」に分ける
const SUBFOLDER_DOCS = "01_書類（サイン前）";
const SUBFOLDER_PDFS = "02_サイン済みPDF";

function getOrCreateSubFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** "2026-07-19" → "令和８年７月１９日" */
function formatJapaneseDate_(iso) {
  const parts = String(iso).split("-");
  if (parts.length !== 3) return toZenkaku_(String(iso));
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return toZenkaku_(toWareki_(d));
}

// ================= ③ サイン =================
/** 利用者フォルダ内の書類一覧（Docs＝サイン可、PDF＝署名済み等） */
function listClientDocs(officeKey, clientName) {
  const folder = getOrCreateClientFolder_(officeKey, clientName);
  const docs = [];
  const pdfs = [];
  // 2026-10-22 COCOiRO：旧構成（直下に混在）と新構成（サブフォルダ）の両方を見る
  const scan = function (f) {
    if (!f) return;
    const it = f.getFiles();
    while (it.hasNext()) {
      const file = it.next();
      const mime = file.getMimeType();
      if (mime === MimeType.GOOGLE_DOCS) docs.push({ id: file.getId(), name: file.getName(), url: file.getUrl() });
      else if (mime === MimeType.PDF) pdfs.push({ name: file.getName(), url: file.getUrl() });
    }
  };
  scan(folder);
  const subs = folder.getFolders();
  while (subs.hasNext()) scan(subs.next());
  const byName = (a, b) => a.name.localeCompare(b.name, "ja");
  return { docs: docs.sort(byName), pdfs: pdfs.sort(byName) };
}

/**
 * 2026-11-04 COCOiRO：1回のサインで、利用者フォルダの「サイン前の書類」すべてに署名する
 * ・サイン画像は各書類の署名欄（本人なら {{署名_利用者}}、代理人なら {{署名_代理人}}）に入る
 * ・各PDFの最後に「署名記録」（対象書類の一覧・署名者・署名日・記録日時）を付ける
 */

/** 発行時に保存した「サインする人」を読む（古いフォルダは本人扱い） */
function getClientMeta_(folder, clientName) {
  let meta = {};
  try { meta = JSON.parse(folder.getDescription() || "{}"); } catch (e) { meta = {}; }
  const display = String(clientName || "").replace(/^\d{8}_/, "").replace(/_\d{8}$/, "");
  return {
    clientName: meta.clientName || display,
    signer: meta.signer === "代理人" ? "代理人" : "本人",
    agentName: meta.agentName || "",
    agentRelation: meta.agentRelation || "",
    kind: meta.kind || "", intent: meta.intent || "", keikaUrl: meta.keikaUrl || "",
    explainMethod: meta.explainMethod || "", explainerName: meta.explainerName || ""
  };
}

/** サイン画面用：サイン前の書類・署名済みPDF・サインする人 */
function getSignInfo(officeKey, clientName) {
  const folder = getOrCreateClientFolder_(officeKey, clientName);
  const list = listClientDocs(officeKey, clientName);
  const signed = list.pdfs.map(function (p) { return p.name; });
  const pending = list.docs.filter(function (d) {
    return !signed.some(function (n) { return n.indexOf(d.name + "_署名済") === 0; });
  });
  return { pending: pending, pdfs: list.pdfs, meta: getClientMeta_(folder, clientName), remote: remoteStatus_(folder.getId()) };
}

function signAll(officeKey, clientName, pngDataUrl, signDateISO) {
  if (!pngDataUrl || pngDataUrl.indexOf("data:image/png") !== 0) throw new Error("サインが読み取れませんでした。もう一度お試しください。");
  const info = getSignInfo(officeKey, clientName);
  if (info.pending.length === 0) throw new Error("サインする書類がありません（すべて署名済みです）。");
  const meta = info.meta;
  const folder = getOrCreateClientFolder_(officeKey, clientName);
  const pdfFolder = getOrCreateSubFolder_(folder, SUBFOLDER_PDFS);
  const sigBlob = Utilities.newBlob(Utilities.base64Decode(pngDataUrl.split(",")[1]), "image/png", "signature.png");

  const now = new Date();
  let signDate = now;
  if (signDateISO) {
    const p = String(signDateISO).split("-");
    if (p.length === 3) signDate = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }
  const dateText = toZenkaku_(toWareki_(signDate)); // 例：令和８年１１月４日
  const signTag = meta.signer === "代理人" ? "{{署名_代理人}}" : "{{署名_利用者}}";
  const docNames = info.pending.map(function (d) { return d.name; });
  const files = [];
  const errors = [];

  info.pending.forEach(function (d) {
    try {
      const src = DriveApp.getFileById(d.id);
      // 元の書類は変更せず、署名用コピーに書き込む
      const copy = src.makeCopy(src.getName() + "＿署名用一時", pdfFolder);
      const doc = DocumentApp.openById(copy.getId());
      const body = doc.getBody();

      body.replaceText(escapeRegex_("{{署名_日付}}"), dateText);
      const placed = insertImageAtTag_(body, signTag, sigBlob, 34, 170);
      // 発行時に署名者を決めていない古い書類の後始末
      body.replaceText("\\{\\{署名_代理人\\}\\}（続柄：\\{\\{署名_続柄\\}\\}）", "");
      body.replaceText(escapeRegex_("{{署名_利用者}}"), meta.clientName);
      body.replaceText("\\{\\{署名_[^}]*\\}\\}", "");

      appendSignRecord_(body, sigBlob, meta, dateText, now, docNames, placed);
      doc.saveAndClose();

      const pdfName = src.getName() + "_署名済_" + Utilities.formatDate(signDate, "Asia/Tokyo", "yyyyMMdd") + "_" + Utilities.formatDate(now, "Asia/Tokyo", "HHmm") + ".pdf";
      const pdfFile = pdfFolder.createFile(copy.getAs("application/pdf").setName(pdfName));
      copy.setTrashed(true); // 一時コピーは削除（署名済みPDFが正）
      files.push({ name: pdfName, url: pdfFile.getUrl() });
    } catch (e) {
      errors.push(d.name + "：" + e.message);
    }
  });

  if (files.length) revokeRemoteLinks_(folder.getId(), "無効(その場で署名)"); // 2026-11-26 COCOiRO v10
  return { folderUrl: pdfFolder.getUrl(), files: files, errors: errors };
}

/** タグの位置にサイン画像を入れる（高さをそろえ、横幅は上限まで）。入れた数を返す */
function insertImageAtTag_(body, tag, blob, heightPt, maxWidthPt) {
  let n = 0;
  let found = body.findText(escapeRegex_(tag));
  while (found) {
    const t = found.getElement().asText();
    const full = t.getText();
    const head = full.substring(0, found.getStartOffset());
    const tail = full.substring(found.getEndOffsetInclusive() + 1);
    const parent = t.getParent();
    const idx = parent.getChildIndex(t);
    t.setText(head || " ");
    const img = parent.insertInlineImage(idx + 1, blob.copyBlob());
    fitImage_(img, heightPt, maxWidthPt);
    if (tail) parent.insertText(idx + 2, tail);
    n++;
    found = body.findText(escapeRegex_(tag));
  }
  return n;
}

function fitImage_(img, heightPt, maxWidthPt) {
  const ratio = img.getWidth() / img.getHeight();
  let h = heightPt;
  let w = Math.round(h * ratio);
  if (w > maxWidthPt) { w = maxWidthPt; h = Math.round(w / ratio); }
  img.setWidth(w);
  img.setHeight(h);
}

/** PDFの最後に付ける署名記録 */
function appendSignRecord_(body, sigBlob, meta, dateText, now, docNames, placed) {
  // 2026-11-23 COCOiRO v8：身体拘束の書類は、最後が空の段落ならそこで改ページする（白紙のページをはさまないため）
  const lastEl = body.getNumChildren() ? body.getChild(body.getNumChildren() - 1) : null;
  if (meta.kind === "kousoku" && lastEl && lastEl.getType() === DocumentApp.ElementType.PARAGRAPH && lastEl.asParagraph().getText() === "") {
    lastEl.asParagraph().appendPageBreak();
  } else {
    body.appendPageBreak();
  }
  const title = body.appendParagraph("署 名 記 録");
  title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph("");
  // 2026-11-23 COCOiRO v8：身体拘束の説明・同意書は「同意しない・保留」でも署名するため、文言を分ける
  body.appendParagraph(meta.kind === "kousoku"
    ? "下記の書類について説明を受け、署名しました。（ご意向：" + (meta.intent || "－") + "）"
    : "下記の書類について説明を受け、その内容に同意のうえ、1回の署名をもって各書類に署名しました。");
  body.appendParagraph("");
  body.appendParagraph("【対象書類】");
  docNames.forEach(function (n) { body.appendParagraph("・" + n); });
  body.appendParagraph("");
  const img = body.appendImage(sigBlob.copyBlob());
  fitImage_(img, 70, 300);
  body.appendParagraph("");
  body.appendParagraph(meta.signer === "代理人"
    ? "署名者：" + meta.agentName + "（利用者 " + meta.clientName + (meta.kind === "kousoku" ? " のご家族等／続柄：" : " の代理人／続柄：") + meta.agentRelation + "）"
    : "署名者：" + meta.clientName + "（利用者本人）");
  if (meta.explainMethod) body.appendParagraph("説明方法：" + meta.explainMethod + (meta.explainerName ? "（説明者：" + meta.explainerName + "）" : "")); // 2026-11-26 COCOiRO v10
  body.appendParagraph("署名日：" + dateText);
  body.appendParagraph("記録日時：" + Utilities.formatDate(now, "Asia/Tokyo", "yyyy/MM/dd HH:mm"));
  if (!placed) body.appendParagraph("※この書類には署名欄がないため、本ページの署名をもって署名とします。");
}




// ============================================================
// 遠隔サイン（2026-11-26 COCOiRO v10）
// ・この場でサインできない遠方のご家族に、書類1件ごとの使い捨てリンクを送り、
//   事業所から伝えた4桁の確認番号を入れてもらってからサインしてもらう
// ・サイン専用アプリは別のGASプロジェクト「〇〇_そのばサイン_遠隔サイン」（アクセス：全員）
//   このアプリの画面・関数（利用者一覧・マスター）は外部に公開しない
// ・リンクの発行状況はマスターの「遠隔サイン管理」タブ（非表示）。専用アプリのURLはスクリプトプロパティ REMOTE_SIGN_URL
// ・説明方法の選択肢は、事業所ごとのマスターの CONFIG.explainTag（「、」区切り）
// ============================================================
const REMOTE_SHEET = "遠隔サイン管理";
const REMOTE_PROP_URL = "REMOTE_SIGN_URL";
const REMOTE_DAYS = 7;
const REMOTE_HEAD = ["トークン", "確認番号", "事業所キー", "事業所名", "事業所電話", "利用者フォルダID", "フォルダ名", "利用者名", "サインする人",
  "発行日時", "有効期限", "状態", "失敗回数", "確認日時", "署名日時", "発行者", "端末", "書類数", "署名済みPDF"];
const EXPLAIN_DEFAULT = "対面、電話、ビデオ通話";

/** 「遠隔サイン管理」タブ（なければ作って非表示にする） */
function remoteSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(REMOTE_SHEET);
  if (!sh) {
    sh = ss.insertSheet(REMOTE_SHEET, ss.getNumSheets());
    sh.getRange("A:B").setNumberFormat("@"); // 確認番号の先頭の0を残す
    sh.getRange(1, 1, 1, REMOTE_HEAD.length).setValues([REMOTE_HEAD])
      .setFontWeight("bold").setBackground("#616161").setFontColor("#ffffff");
    sh.setFrozenRows(1);
    sh.setTabColor("#9e9e9e");
    protectWarn_(sh.getRange(1, 1, sh.getMaxRows(), REMOTE_HEAD.length), "遠隔サインの管理用です。COCOiROが管理しています。");
    sh.hideSheet();
  }
  return sh;
}

function remoteRows_() {
  const sh = remoteSheet_();
  const n = sh.getLastRow() - 1;
  return { sh: sh, rows: n > 0 ? sh.getRange(2, 1, n, REMOTE_HEAD.length).getValues() : [] };
}

/** 状態（未使用のまま期限を過ぎたものは「期限切れ」） */
function remoteState_(r) {
  const st = String(r[11]);
  if (st === "未使用" && r[10] && new Date() > new Date(r[10])) return "期限切れ";
  return st;
}

function remoteFmt_(d) {
  return d ? Utilities.formatDate(new Date(d), "Asia/Tokyo", "yyyy/MM/dd HH:mm") : "";
}

/** その利用者フォルダの、いちばん新しいリンクの状態 */
function remoteStatus_(folderId) {
  const x = remoteRows_();
  for (let i = x.rows.length - 1; i >= 0; i--) {
    const r = x.rows[i];
    if (String(r[5]) !== folderId) continue;
    return {
      state: remoteState_(r), code: String(r[1]), signerName: String(r[8]),
      issuedAt: remoteFmt_(r[9]), expiresAt: remoteFmt_(r[10]), signedAt: remoteFmt_(r[14]), fails: Number(r[12]) || 0
    };
  }
  return null;
}

/** その利用者フォルダの未使用のリンクを使えなくする */
function revokeRemoteLinks_(folderId, label) {
  const x = remoteRows_();
  x.rows.forEach(function (r, i) {
    if (String(r[5]) === folderId && String(r[11]) === "未使用") x.sh.getRange(i + 2, 12).setValue(label);
  });
}

/** サイン画面：遠方のご家族に送るリンクと確認番号を発行する（前のリンクは使えなくなる） */
function issueRemoteLink(officeKey, clientName) {
  const base = PropertiesService.getScriptProperties().getProperty(REMOTE_PROP_URL);
  if (!base) throw new Error("遠隔サインの準備ができていません。COCOiROに連絡してください。");
  const info = getSignInfo(officeKey, clientName);
  if (info.pending.length === 0) throw new Error("サインする書類がありません(すべて署名済みです)。");
  const folder = getOrCreateClientFolder_(officeKey, clientName);
  const office = getOffice_(officeKey);
  const master = loadMaster_(office.key);
  const meta = info.meta;
  const signerName = meta.signer === "代理人" ? meta.agentName : meta.clientName;
  const phone = master[CONFIG.officePhoneTag] || "";
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "").toLowerCase();
  const code = ("000" + Math.floor(Math.random() * 10000)).slice(-4);
  const now = new Date();
  const exp = new Date(now.getTime() + REMOTE_DAYS * 86400000);
  exp.setHours(23, 59, 59, 0);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    revokeRemoteLinks_(folder.getId(), "無効(再発行)");
    remoteSheet_().appendRow([token, code, office.key, office.name, phone, folder.getId(), folder.getName(), meta.clientName, signerName,
      now, exp, "未使用", 0, "", "", "" /* 発行者：Session を使うと権限の追加承認が要るため記録しない */, "", info.pending.length, ""]);
  } finally {
    lock.releaseLock();
  }

  const url = base + "?t=" + token;
  const expText = toZenkaku_(toWareki_(exp));
  const what = meta.kind === "kousoku" ? "身体拘束に関する説明・同意書" : "ご契約の書類";
  const message = [
    signerName + " 様",
    "",
    office.name + "です。",
    meta.clientName + " 様の" + what + "について、下のリンクからサインをお願いいたします。",
    "",
    "1. リンクを開く",
    "2. 事業所からお伝えした4桁の確認番号を入力",
    "3. 書類の内容を確認し、日付を選んでサイン",
    "",
    url,
    "",
    "有効期限：" + expText + "まで",
    "ご不明な点は、お気軽に事業所までお電話ください。" + (phone ? "(" + phone + ")" : "")
  ].join("\n");
  return { url: url, code: code, expiresAt: expText, message: message, signerName: signerName, status: remoteStatus_(folder.getId()) };
}

/** サイン画面：発行したリンクを使えなくする */
function revokeRemoteLink(officeKey, clientName) {
  const folder = getOrCreateClientFolder_(officeKey, clientName);
  revokeRemoteLinks_(folder.getId(), "無効(職員が停止)");
  return remoteStatus_(folder.getId());
}

/** 【COCOiRO・最初に1回】遠隔サインの準備。何度実行しても同じ結果になる */
function setupRemoteSign() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = [];
  remoteSheet_();
  log.push("「" + REMOTE_SHEET + "」タブ：準備済み");
  OFFICES.forEach(function (o) {
    const sh = ss.getSheetByName(o.sheet);
    if (!sh) { log.push(o.sheet + "：タブがありません"); return; }
    const tags = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(function (r) { return String(r[0]).trim(); });
    if (tags.indexOf(CONFIG.explainTag) >= 0) { log.push(o.sheet + "：説明方法の選択肢は追加済み"); return; }
    const row = sh.getLastRow() + 1;
    sh.getRange(row - 1, 1, 1, 3).copyFormatToRange(sh, 1, 3, row, row);
    sh.getRange(row, 1, 1, 3).setValues([[CONFIG.explainTag, EXPLAIN_DEFAULT, "「、」で区切る。書類発行の「説明方法」の選択肢になります(「その他」は自動で付きます)"]]);
    sh.setRowHeight(row, 28);
    log.push(o.sheet + "：説明方法の選択肢を追加");
  });
  const url = PropertiesService.getScriptProperties().getProperty(REMOTE_PROP_URL);
  log.push("サイン専用アプリのURL：" + (url || "未設定"));
  Logger.log(log.join("\n"));
}
