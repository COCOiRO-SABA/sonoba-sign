/**
 * そのばサイン（ふわりの森・居宅介護支援事業所らふたす）
 * Webapp.gs … Webアプリの入口と各処理
 * v2（2026-11-17）サインする人・代理人の住所・続柄を発行時に入れる形に変更
 */

const DIR_BEFORE = '01_書類（サイン前）';
const DIR_SIGNED = '02_サイン済みPDF';
const SIGN_TAGS = ['署名_利用者', '署名_代理人', '代理人_住所', '代理人_続柄'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('そのばサイン')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function outputFolder_() {
  const id = PropertiesService.getScriptProperties().getProperty('OUTPUT_FOLDER_ID');
  if (!id) throw new Error('出力先フォルダが設定されていません（初期設定が必要です）');
  return DriveApp.getFolderById(id);
}

/* ========== 事業所情報タブ ========== */

function getInitData() {
  const raw = loadMaster_();
  const names = String(raw['居宅_説明者候補'] || raw['居宅_管理者名'] || '')
    .split(/[、,，]/).map(function (s) { return s.trim(); }).filter(String);
  return {
    office: raw['居宅_事業所名'] || '',
    explainers: names,
    rows: loadMasterRows_(),
    templates: loadTemplates_().map(function (t) { return t.name; })
  };
}

function saveMaster(changes) {
  const ss = SpreadsheetApp.getActive();
  (changes || []).forEach(function (c) {
    if (MASTER_SHEETS.indexOf(c.sheet) < 0) return;
    const sh = ss.getSheetByName(c.sheet);
    const tag = sh.getRange(c.row, 1).getDisplayValue();
    if (tag !== c.tag) throw new Error('マスタの行がずれています。画面を読み込み直してください');
    sh.getRange(c.row, 2).setValue(c.value);
  });
  return getInitData();
}

/* ========== 書類発行タブ ========== */

/**
 * form: {name, zip, address, explainDate, contractDate, explainer,
 *   termStart, termEnd, receipt('紙'|'電子'|'相談'|''), contactName, contactTel, contactMail,
 *   signer('本人'|'代理人'), agentRelation, agentAddress}
 * サインする人・代理人の住所・続柄は、ここ（発行時）で職員が入れる。
 * 利用者・家族はサインの画面でサインするだけ。
 */
function generateForClient(form) {
  const name = String(form.name || '').trim();
  if (!name) throw new Error('利用者名を入れてください');
  const signer = form.signer === '代理人' ? '代理人' : '本人';
  const relation = String(form.agentRelation || '').trim();
  const agentAddress = String(form.agentAddress || '').trim();
  if (signer === '代理人' && !relation) throw new Error('代理人の続柄を入れてください');

  const map = masterForDoc_();
  const zip = String(form.zip || '').trim();
  const addr = String(form.address || '').trim();
  map['利用者_氏名'] = toZenkaku_(name);
  map['利用者_郵便番号'] = toZenkaku_(zip);
  map['利用者_住所'] = toZenkaku_((zip ? '〒' + zip + ' ' : '') + addr);
  map['説明日'] = toWareki_(form.explainDate);
  map['契約日'] = toWareki_(form.contractDate);
  map['説明者_氏名'] = toZenkaku_(form.explainer || '');
  map['契約_開始日'] = toWareki_(form.termStart);
  map['契約_終了日'] = toWareki_(form.termEnd);
  map['受領_紙'] = form.receipt === '紙' ? '■' : '□';
  map['受領_電子'] = form.receipt === '電子' ? '■' : '□';
  map['受領_相談'] = form.receipt === '相談' ? '■' : '□';
  map['連絡先_代表者名'] = toZenkaku_(form.contactName || '');
  map['連絡先_電話番号'] = toZenkaku_(form.contactTel || '');
  map['連絡先_メール'] = String(form.contactMail || '').trim();

  // 署名欄：サインする人に合わせて、発行の時点で埋められるところは埋めておく
  if (signer === '代理人') {
    map['署名_利用者'] = toZenkaku_(name);          // ご本人の欄は氏名を印字
    map['代理人_住所'] = toZenkaku_(agentAddress);
    map['代理人_続柄'] = toZenkaku_(relation);
  } else {
    map['署名_代理人'] = '';
    map['代理人_住所'] = '';
    map['代理人_続柄'] = '';
  }

  const stamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');
  const root = outputFolder_();
  const client = uniqueFolder_(root, name + '_' + stamp);
  client.setDescription(JSON.stringify({
    v: 2, signer: signer, agentRelation: relation, agentAddress: agentAddress,
    issuedAt: Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm')
  }));
  const before = client.createFolder(DIR_BEFORE);
  client.createFolder(DIR_SIGNED);

  const docs = [];
  loadTemplates_().forEach(function (t) {
    const fileName = t.fileName.replace(/\{\{利用者_氏名\}\}/g, name);
    const copy = DriveApp.getFileById(t.id).makeCopy(fileName, before);
    const doc = DocumentApp.openById(copy.getId());
    replaceTagsInDoc_(doc, map);
    doc.saveAndClose();
    docs.push({ id: copy.getId(), name: fileName, url: copy.getUrl() });
  });
  return { folder: client.getName(), folderUrl: client.getUrl(), docs: docs, signer: signerLabel_(name, readIssueInfo_(client)) };
}

function uniqueFolder_(parent, base) {
  let n = base, i = 2;
  while (parent.getFoldersByName(n).hasNext()) { n = base + '_' + i; i++; }
  return parent.createFolder(n);
}

/** 利用者フォルダの説明欄に保存した発行時の情報。古い版（情報なし）はご本人として扱う */
function readIssueInfo_(folder) {
  try {
    const o = JSON.parse(folder.getDescription() || '{}');
    return {
      signer: o.signer === '代理人' ? '代理人' : '本人',
      agentRelation: String(o.agentRelation || ''),
      agentAddress: String(o.agentAddress || ''),
      known: !!o.signer
    };
  } catch (e) {
    return { signer: '本人', agentRelation: '', agentAddress: '', known: false };
  }
}

function signerLabel_(clientName, info) {
  return info.signer === '代理人'
    ? '代理人（' + clientName + 'さんの' + info.agentRelation + '）'
    : clientName + 'さん（ご本人）';
}

/* ========== サインタブ ========== */

/** 利用者フォルダごとの書類一覧（利用者名順） */
function listClientDocs() {
  const root = outputFolder_();
  const out = [];
  const fit = root.getFolders();
  while (fit.hasNext()) {
    const f = fit.next();
    const beforeIt = f.getFoldersByName(DIR_BEFORE);
    const signedIt = f.getFoldersByName(DIR_SIGNED);
    const before = beforeIt.hasNext() ? beforeIt.next() : f; // 旧構成（直下に混在）も見る
    const signed = signedIt.hasNext() ? signedIt.next() : f;

    const pdfs = {};
    const pit = signed.getFilesByType(MimeType.PDF);
    while (pit.hasNext()) { const p = pit.next(); pdfs[p.getName()] = p.getUrl(); }

    const docs = [];
    const dit = before.getFilesByType(MimeType.GOOGLE_DOCS);
    while (dit.hasNext()) {
      const d = dit.next();
      const pdfName = d.getName() + '_サイン済.pdf';
      docs.push({ id: d.getId(), name: d.getName(), url: d.getUrl(), signed: !!pdfs[pdfName], pdfUrl: pdfs[pdfName] || '' });
    }
    if (!docs.length) continue;
    docs.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    const info = readIssueInfo_(f);
    const clientName = clientNameFromFolder_(f.getName());
    out.push({
      folder: f.getName(), folderUrl: f.getUrl(), docs: docs,
      signer: info.signer, signerLabel: signerLabel_(clientName, info)
    });
  }
  out.sort(function (a, b) { return a.folder.localeCompare(b.folder, 'ja'); });
  return out;
}

/**
 * p: {docId, sig(dataURL)}
 * サインする人は発行時の情報で決まっている。利用者・家族はサインするだけ。
 * 書類のコピーにサインを入れてPDFにし、02_サイン済みPDF に保存する。サイン前の書類はそのまま残す
 */
function signDocument(p) {
  if (!p || !p.docId) throw new Error('書類を選んでください');
  if (!p.sig) throw new Error('サインがありません');

  const src = DriveApp.getFileById(p.docId);
  const beforeFolder = src.getParents().next();
  const clientFolder = beforeFolder.getName() === DIR_BEFORE ? beforeFolder.getParents().next() : beforeFolder;
  const signedIt = clientFolder.getFoldersByName(DIR_SIGNED);
  const signedFolder = signedIt.hasNext() ? signedIt.next() : clientFolder.createFolder(DIR_SIGNED);

  const pdfName = src.getName() + '_サイン済.pdf';
  if (signedFolder.getFilesByName(pdfName).hasNext()) throw new Error('この書類はサイン済みです');

  const info = readIssueInfo_(clientFolder);
  const userName = clientNameFromFolder_(clientFolder.getName());

  const tmp = src.makeCopy(src.getName() + '_署名作業中', signedFolder);
  try {
    const doc = DocumentApp.openById(tmp.getId());
    const body = doc.getBody();

    if (info.signer === '代理人') {
      insertSignature_(body, '署名_代理人', p.sig);
      replaceTagsInDoc_(doc, {
        '署名_利用者': toZenkaku_(userName),
        '代理人_住所': toZenkaku_(info.agentAddress),
        '代理人_続柄': toZenkaku_(info.agentRelation)
      });
    } else {
      insertSignature_(body, '署名_利用者', p.sig);
    }
    // 残ったサイン用のタグは空にする
    const rest = {};
    SIGN_TAGS.forEach(function (t) { rest[t] = ''; });
    replaceTagsInDoc_(doc, rest);
    doc.saveAndClose();

    const pdf = tmp.getAs(MimeType.PDF).setName(pdfName);
    const saved = signedFolder.createFile(pdf);
    return { pdfUrl: saved.getUrl(), name: pdfName };
  } finally {
    tmp.setTrashed(true);
  }
}

function clientNameFromFolder_(folderName) {
  return String(folderName).replace(/_\d{8}(_\d+)?$/, '');
}

/** タグの位置にサイン画像を入れる（見つかったものすべて） */
function insertSignature_(body, tag, dataUrl) {
  const b64 = String(dataUrl).split(',')[1];
  const pattern = '\\{\\{' + escapeRegex_(tag) + '\\}\\}';
  let r = body.findText(pattern);
  while (r) {
    const text = r.getElement().asText();
    const start = r.getStartOffset();
    text.deleteText(start, r.getEndOffsetInclusive());
    const para = text.getParent();
    const blob = Utilities.newBlob(Utilities.base64Decode(b64), 'image/png', tag + '.png');
    const childIndex = para.getChildIndex(text);
    let img;
    if (start === 0) img = para.insertInlineImage(childIndex, blob);
    else img = para.insertInlineImage(childIndex + 1, blob);
    const w = img.getWidth(), h = img.getHeight();
    const targetH = 40;
    img.setHeight(targetH).setWidth(Math.round(w * targetH / h));
    r = body.findText(pattern);
  }
}
