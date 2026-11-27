/**
 * ============================================================
 * そのばサイン 遠隔サイン  2026-11-26 COCOiRO
 * ============================================================
 * 遠方のご家族が、使い捨てのリンクと4桁の確認番号で、書類の確認とサインをする専用アプリ。
 * ・リンクは職員用アプリ(〇〇_そのばサイン)の「サイン」画面で、書類1件ごとに発行する
 * ・画面に出すのは、そのリンクの利用者の「サイン前の書類」だけ。利用者一覧やマスターは扱わない
 * ・確認番号を5回まちがえる／有効期限(7日)を過ぎる／署名する／職員が止める と使えなくなる
 * ・リンクの状態はマスターの「遠隔サイン管理」タブ(非表示)に記録する
 *
 * 【デプロイ】ウェブアプリ／実行ユーザー：自分(各社の作業アカウント)／アクセスできるユーザー：全員
 * 2回目以降は「デプロイを管理」から既存のデプロイにバージョンを足す(URLを変えない)
 * デプロイのURLは、職員用アプリのスクリプトプロパティ REMOTE_SIGN_URL に入れる
 */

// MASTER_ID は会社ごとの設定(config.js)にある
const REMOTE_SHEET = "遠隔サイン管理";
const MAX_FAILS = 5;
const COPY_HOURS = 24; // 署名後、控えをダウンロードできる時間
const SUBFOLDER_DOCS = "01_書類（サイン前）";
const SUBFOLDER_PDFS = "02_サイン済みPDF";
// 「遠隔サイン管理」タブの列(1始まり)
const C = {
  token: 1, code: 2, officeKey: 3, officeName: 4, officePhone: 5, folderId: 6, folderName: 7, clientName: 8, signerName: 9,
  issuedAt: 10, expiresAt: 11, status: 12, fails: 13, verifiedAt: 14, signedAt: 15, issuer: 16, ua: 17, docCount: 18, signedPdfs: 19
};
const NCOL = 19;

// ================= 入口 =================
function doGet(e) {
  const t = HtmlService.createTemplateFromFile("index");
  t.token = String((e && e.parameter && e.parameter.t) || "").toLowerCase().replace(/[^0-9a-f]/g, "").slice(0, 64);
  return t.evaluate()
    .setTitle("そのばサイン｜書類へのサイン")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1");
}

// ================= リンクの確認 =================
function sheet_() {
  const sh = SpreadsheetApp.openById(MASTER_ID).getSheetByName(REMOTE_SHEET);
  if (!sh) throw new Error("このリンクは使えません。事業所にお問い合わせください。");
  return sh;
}

/**
 * トークンと確認番号を確かめて、その行を返す。
 * opts.afterSign：署名後の控えのダウンロード(署名済みでも、署名から COPY_HOURS 時間は通す)
 */
function check_(token, code, opts) {
  opts = opts || {};
  token = String(token || "");
  if (token.length !== 64) throw new Error("このリンクは使えません。事業所から届いたリンクをもう一度開いてください。");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = sheet_();
    const n = sh.getLastRow() - 1;
    if (n < 1) throw new Error("このリンクは使えません。事業所にお問い合わせください。");
    const tokens = sh.getRange(2, C.token, n, 1).getValues();
    let row = 0;
    for (let i = 0; i < tokens.length; i++) if (String(tokens[i][0]) === token) { row = i + 2; break; }
    if (!row) throw new Error("このリンクは使えません。事業所から届いたリンクをもう一度開いてください。");
    const r = sh.getRange(row, 1, 1, NCOL).getValues()[0];
    const status = String(r[C.status - 1]);
    const phone = String(r[C.officePhone - 1] || "");
    const call = "事業所" + (phone ? "(" + phone + ")" : "") + "にお電話ください。";

    if (status === "署名済み") {
      const signedAt = r[C.signedAt - 1] ? new Date(r[C.signedAt - 1]) : null;
      if (!(opts.afterSign && signedAt && new Date() - signedAt < COPY_HOURS * 3600000)) {
        throw new Error("この書類は署名済みです。ありがとうございました。");
      }
    } else if (status === "ロック") {
      throw new Error("確認番号を" + MAX_FAILS + "回まちがえたため、このリンクは使えなくなりました。" + call);
    } else if (status !== "未使用") {
      throw new Error("このリンクは使えなくなりました。事業所から届いた新しいリンクを開くか、" + call);
    } else if (r[C.expiresAt - 1] && new Date() > new Date(r[C.expiresAt - 1])) {
      throw new Error("リンクの有効期限が切れています。" + call);
    }

    if (String(code || "") !== String(r[C.code - 1])) {
      if (status !== "未使用") throw new Error("確認番号がちがいます。");
      const fails = (Number(r[C.fails - 1]) || 0) + 1;
      sh.getRange(row, C.fails).setValue(fails);
      if (fails >= MAX_FAILS) {
        sh.getRange(row, C.status).setValue("ロック");
        throw new Error("確認番号を" + MAX_FAILS + "回まちがえたため、このリンクは使えなくなりました。" + call);
      }
      throw new Error("確認番号がちがいます。事業所からお伝えした4桁の番号を入れてください。(あと" + (MAX_FAILS - fails) + "回)");
    }
    return { sh: sh, row: row, r: r };
  } finally {
    lock.releaseLock();
  }
}

// ================= 書類の一覧 =================
/** 利用者フォルダの「サイン前の書類」と署名済みPDF、発行時の情報 */
function folderInfo_(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  let meta = {};
  try { meta = JSON.parse(folder.getDescription() || "{}"); } catch (e) { meta = {}; }
  const docs = [];
  const pdfs = [];
  const scan = function (f) {
    const it = f.getFiles();
    while (it.hasNext()) {
      const file = it.next();
      const mime = file.getMimeType();
      if (mime === MimeType.GOOGLE_DOCS) docs.push({ id: file.getId(), name: file.getName() });
      else if (mime === MimeType.PDF) pdfs.push({ id: file.getId(), name: file.getName() });
    }
  };
  scan(folder);
  const subs = folder.getFolders();
  while (subs.hasNext()) scan(subs.next());
  const byName = function (a, b) { return a.name.localeCompare(b.name, "ja"); };
  docs.sort(byName);
  const pending = docs.filter(function (d) {
    return !pdfs.some(function (p) { return p.name.indexOf(d.name + "_署名済") === 0; });
  });
  return {
    folder: folder, pending: pending, pdfs: pdfs,
    meta: {
      clientName: meta.clientName || "", signer: meta.signer === "代理人" ? "代理人" : "本人",
      agentName: meta.agentName || "", agentRelation: meta.agentRelation || "",
      kind: meta.kind || "", intent: meta.intent || "",
      explainMethod: meta.explainMethod || "", explainerName: meta.explainerName || ""
    }
  };
}

/** 画面に出す書類名(「通所_重要事項説明書_山田 太郎_20261126」→「重要事項説明書」) */
function displayName_(name, clientName) {
  let s = String(name);
  if (clientName) s = s.split("_" + clientName + "_")[0];
  s = s.replace(/^通所_/, "").replace(/^介護S_/, "介護サポート ").replace(/^身体拘束_/, "身体拘束 ").replace(/_/g, " ");
  return s;
}

// ================= 画面から呼ぶ処理 =================
/** 確認番号を確かめて、サインする人と書類の一覧を返す */
function remoteOpen(token, code, ua) {
  const x = check_(token, code);
  if (!x.r[C.verifiedAt - 1]) x.sh.getRange(x.row, C.verifiedAt).setValue(new Date());
  if (ua) x.sh.getRange(x.row, C.ua).setValue(String(ua).slice(0, 300));
  const info = folderInfo_(String(x.r[C.folderId - 1]));
  if (info.pending.length === 0) throw new Error("サインする書類がありません。事業所にお問い合わせください。");
  const m = info.meta;
  return {
    officeName: String(x.r[C.officeName - 1]),
    officePhone: String(x.r[C.officePhone - 1] || ""),
    clientName: m.clientName,
    signerLabel: m.signer === "代理人"
      ? m.agentName + " 様(" + m.clientName + " 様の" + (m.kind === "kousoku" ? "ご家族等" : "代理人") + "・" + m.agentRelation + ")"
      : m.clientName + " 様(ご本人)",
    explainMethod: m.explainMethod,
    kind: m.kind,
    docs: info.pending.map(function (d, i) { return { index: i, name: displayName_(d.name, m.clientName) }; })
  };
}

/** 書類の内容を確認するためのPDF(署名欄のタグは「ここにサインが入ります」に置き換える) */
function remoteDocPdf(token, code, index) {
  const x = check_(token, code);
  const info = folderInfo_(String(x.r[C.folderId - 1]));
  const d = info.pending[Number(index)];
  if (!d) throw new Error("書類が見つかりません。画面を開き直してください。");
  const tmpParent = getOrCreateSubFolder_(info.folder, SUBFOLDER_PDFS);
  const copy = DriveApp.getFileById(d.id).makeCopy(d.name + "＿確認用一時", tmpParent);
  try {
    const doc = DocumentApp.openById(copy.getId());
    [doc.getBody(), doc.getHeader(), doc.getFooter()].forEach(function (s) {
      if (!s) return;
      s.replaceText("\\{\\{署名_利用者\\}\\}", info.meta.signer === "代理人" ? info.meta.clientName : "(ここにサインが入ります)");
      s.replaceText("\\{\\{署名_代理人\\}\\}", info.meta.signer === "代理人" ? "(ここにサインが入ります)" : "");
      s.replaceText("\\{\\{署名_日付\\}\\}", "(署名日)");
      s.replaceText("\\{\\{署名_[^}]*\\}\\}", "");
    });
    doc.saveAndClose();
    const bytes = copy.getAs("application/pdf").getBytes();
    return { name: displayName_(d.name, info.meta.clientName), b64: Utilities.base64Encode(bytes) };
  } finally {
    copy.setTrashed(true);
  }
}

/** 1回のサインで、サイン前の書類すべてに署名する(職員用アプリの signAll と同じ形) */
function remoteSign(token, code, pngDataUrl, signDateISO, ua) {
  if (!pngDataUrl || String(pngDataUrl).indexOf("data:image/png") !== 0) throw new Error("サインが読み取れませんでした。もう一度お試しください。");
  {
    const x = check_(token, code);
    const info = folderInfo_(String(x.r[C.folderId - 1]));
    if (info.pending.length === 0) throw new Error("サインする書類がありません。事業所にお問い合わせください。");
    const meta = info.meta;
    const pdfFolder = getOrCreateSubFolder_(info.folder, SUBFOLDER_PDFS);
    const sigBlob = Utilities.newBlob(Utilities.base64Decode(String(pngDataUrl).split(",")[1]), "image/png", "signature.png");

    const now = new Date();
    let signDate = now;
    const p = String(signDateISO || "").split("-");
    if (p.length === 3) signDate = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    const dateText = toZenkaku_(toWareki_(signDate));
    const signTag = meta.signer === "代理人" ? "{{署名_代理人}}" : "{{署名_利用者}}";
    const docNames = info.pending.map(function (d) { return d.name; });
    const remoteLines = [
      "署名方法：遠隔(書類ごとのリンクと、事業所から伝えた確認番号で本人確認)",
      "リンク発行：" + fmt_(x.r[C.issuedAt - 1]) + (x.r[C.issuer - 1] ? "(発行者 " + x.r[C.issuer - 1] + ")" : ""),
      "確認番号の確認：" + fmt_(x.r[C.verifiedAt - 1] || now),
      "端末：" + String(ua || x.r[C.ua - 1] || "").slice(0, 160)
    ];
    const files = [];
    const errors = [];

    info.pending.forEach(function (d) {
      try {
        const src = DriveApp.getFileById(d.id);
        const copy = src.makeCopy(src.getName() + "＿署名用一時", pdfFolder);
        const doc = DocumentApp.openById(copy.getId());
        const body = doc.getBody();
        body.replaceText(escapeRegex_("{{署名_日付}}"), dateText);
        const placed = insertImageAtTag_(body, signTag, sigBlob, 34, 170);
        body.replaceText("\\{\\{署名_代理人\\}\\}（続柄：\\{\\{署名_続柄\\}\\}）", "");
        body.replaceText(escapeRegex_("{{署名_利用者}}"), meta.clientName);
        body.replaceText("\\{\\{署名_[^}]*\\}\\}", "");
        appendSignRecord_(body, sigBlob, meta, dateText, now, docNames, placed, remoteLines);
        doc.saveAndClose();
        const pdfName = src.getName() + "_署名済_" + Utilities.formatDate(signDate, "Asia/Tokyo", "yyyyMMdd") + "_" + Utilities.formatDate(now, "Asia/Tokyo", "HHmm") + ".pdf";
        const pdfFile = pdfFolder.createFile(copy.getAs("application/pdf").setName(pdfName));
        copy.setTrashed(true);
        files.push({ id: pdfFile.getId(), name: displayName_(src.getName(), meta.clientName) });
      } catch (e) {
        errors.push(displayName_(d.name, meta.clientName) + "：" + e.message);
      }
    });

    if (files.length) {
      x.sh.getRange(x.row, C.status).setValue(errors.length ? "未使用" : "署名済み");
      x.sh.getRange(x.row, C.signedAt).setValue(now);
      if (ua) x.sh.getRange(x.row, C.ua).setValue(String(ua).slice(0, 300));
      x.sh.getRange(x.row, C.signedPdfs).setValue(JSON.stringify(files));
    }
    if (errors.length) throw new Error("署名できなかった書類があります。事業所にお電話ください。(" + errors.join("／") + ")");
    return { count: files.length, files: files.map(function (f, i) { return { index: i, name: f.name }; }) };
  }
}

/** 署名後の控え(署名済みPDF)。署名から COPY_HOURS 時間まで */
function remoteSignedPdf(token, code, index) {
  const x = check_(token, code, { afterSign: true });
  let files = [];
  try { files = JSON.parse(String(x.r[C.signedPdfs - 1] || "[]")); } catch (e) { files = []; }
  const f = files[Number(index)];
  if (!f) throw new Error("控えが見つかりません。事業所にお問い合わせください。");
  return { name: f.name + "(署名済み).pdf", b64: Utilities.base64Encode(DriveApp.getFileById(f.id).getBlob().getBytes()) };
}

// ================= 書類づくりの部品(職員用アプリと同じ) =================
const ZENKAKU_SYMBOL_MAP = { "-": "－", ":": "：", "%": "％", "~": "～", "(": "（", ")": "）", "/": "／", ".": "．", ",": "，", " ": " " };
function toZenkaku_(text) {
  return String(text)
    .replace(/[0-9]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) + 0xFEE0); })
    .replace(/[-:%~()\/.,]/g, function (ch) { return ZENKAKU_SYMBOL_MAP[ch] || ch; });
}
function toWareki_(d) {
  return "令和" + (d.getFullYear() - 2018) + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
}
function escapeRegex_(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function fmt_(d) {
  return d ? Utilities.formatDate(new Date(d), "Asia/Tokyo", "yyyy/MM/dd HH:mm") : "";
}
function getOrCreateSubFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/** タグの位置にサイン画像を入れる(高さをそろえ、横幅は上限まで)。入れた数を返す */
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

/** PDFの最後に付ける署名記録(職員用アプリと同じ形＋遠隔サインの記録) */
function appendSignRecord_(body, sigBlob, meta, dateText, now, docNames, placed, extraLines) {
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
  if (meta.explainMethod) body.appendParagraph("説明方法：" + meta.explainMethod + (meta.explainerName ? "（説明者：" + meta.explainerName + "）" : ""));
  body.appendParagraph("署名日：" + dateText);
  body.appendParagraph("記録日時：" + Utilities.formatDate(now, "Asia/Tokyo", "yyyy/MM/dd HH:mm"));
  (extraLines || []).forEach(function (l) { body.appendParagraph(l); });
  if (!placed) body.appendParagraph("※この書類には署名欄がないため、本ページの署名をもって署名とします。");
}

