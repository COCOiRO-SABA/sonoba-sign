/**
 * そのばサイン（ふわりの森・居宅介護支援事業所らふたす）
 * コード.gs … マスタ読み込み・変換・初期設定・メニュー
 */

// テンプレート原本（COCOiRO管理）。初期設定のときだけ使う
const TEMPLATE_SOURCE_ID = '10Ra-SPIacvu8rQmkJBRkAi0DGgJODuHzlu4JKVAArK4';

const SHEET_HOWTO   = '使い方';
const SHEET_COMMON  = 'マスター_共通';
const SHEET_KYOTAKU = 'マスター_居宅';
const SHEET_TPL     = 'テンプレート（COCOiRO管理）';
const MASTER_SHEETS = [SHEET_COMMON, SHEET_KYOTAKU];

// 全角に変換しないタグ
const NO_ZENKAKU_TAGS = ['連絡先_メール'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('そのばサイン')
    .addItem('Webアプリを開く', 'showAppUrl_')
    .addSeparator()
    .addItem('初期設定（COCOiRO用）', 'setupSonoba')
    .addToUi();
}

function showAppUrl_() {
  const url = ScriptApp.getService().getUrl();
  const html = url
    ? '<p style="font-family:sans-serif">下のリンクから開いてください。</p><p><a href="' + url + '" target="_blank">そのばサインを開く</a></p>'
    : '<p style="font-family:sans-serif">まだデプロイされていません。COCOiROに連絡してください。</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(360).setHeight(140), 'そのばサイン');
}

/* ========== マスタ ========== */

/** 全マスタタブを {タグ名: 値} にまとめる */
function loadMaster_() {
  const ss = SpreadsheetApp.getActive();
  const map = {};
  MASTER_SHEETS.forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 4) return;
    const rows = sh.getRange(4, 1, sh.getLastRow() - 3, 3).getDisplayValues();
    rows.forEach(function (r) {
      const tag = String(r[0]).trim();
      if (tag) map[tag] = String(r[1]);
    });
  });
  return map;
}

/** マスタの行一覧（事業所情報タブ用） */
function loadMasterRows_() {
  const ss = SpreadsheetApp.getActive();
  const out = [];
  MASTER_SHEETS.forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 4) return;
    const rows = sh.getRange(4, 1, sh.getLastRow() - 3, 3).getDisplayValues();
    rows.forEach(function (r, i) {
      if (!String(r[0]).trim()) return;
      out.push({ sheet: name, row: i + 4, tag: r[0], value: r[1], memo: r[2] });
    });
  });
  return out;
}

/** テンプレート対応表 [{name, id, fileName}] */
function loadTemplates_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_TPL);
  if (!sh || sh.getLastRow() < 4) return [];
  return sh.getRange(4, 1, sh.getLastRow() - 3, 3).getDisplayValues()
    .filter(function (r) { return r[0] && r[1]; })
    .map(function (r) {
      const m = String(r[1]).match(/[-\w]{25,}/);
      return { name: r[0], id: m ? m[0] : '', fileName: r[2] || ('{{利用者_氏名}}_' + r[0]) };
    })
    .filter(function (t) { return t.id; });
}

/* ========== 変換 ========== */

/** 半角英数記号・スペースを全角に */
function toZenkaku_(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/[!-~]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0xFEE0); })
    .replace(/ /g, '　');
}

/** yyyy-mm-dd → 令和○年○月○日（全角）。空なら空欄の書式 */
function toWareki_(ymd) {
  const blank = '令和　　年　　月　　日';
  if (!ymd) return blank;
  const m = String(ymd).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return blank;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  if (y < 2019) return blank;
  const ry = y - 2018;
  return toZenkaku_('令和' + (ry === 1 ? '元' : ry) + '年' + mo + '月' + d + '日');
}

/** ドキュメント全体（本文・ヘッダー・フッター）のタグを置換 */
function replaceTagsInDoc_(doc, map) {
  const parts = [doc.getBody(), doc.getHeader(), doc.getFooter()];
  // 最初のページ用・偶数ページ用ヘッダーも含める
  try {
    const p = doc.getBody().getParent();
    for (let i = 0; i < p.getNumChildren(); i++) {
      const c = p.getChild(i);
      const t = c.getType();
      if (t === DocumentApp.ElementType.HEADER_SECTION || t === DocumentApp.ElementType.FOOTER_SECTION) parts.push(c);
    }
  } catch (e) {}
  parts.forEach(function (sec) {
    if (!sec) return;
    Object.keys(map).forEach(function (tag) {
      sec.replaceText('\\{\\{' + escapeRegex_(tag) + '\\}\\}', escapeReplacement_(map[tag]));
    });
    sec.replaceText('㊞', '');
    sec.replaceText('㋞', '');
  });
}

function escapeRegex_(s) { return String(s).replace(/[.*+?^$(){}|[\]\\]/g, '\\$&'); }
function escapeReplacement_(s) { return String(s).replace(/\$/g, '$$$$'); }

/** マスタ値を差し込み用に変換 */
function masterForDoc_() {
  const raw = loadMaster_();
  const map = {};
  Object.keys(raw).forEach(function (k) {
    map[k] = NO_ZENKAKU_TAGS.indexOf(k) >= 0 ? raw[k] : toZenkaku_(raw[k]);
  });
  return map;
}

/* ========== 初期設定（COCOiRO用） ========== */

function setupSonoba() {
  const ss = SpreadsheetApp.getActive();
  const file = DriveApp.getFileById(ss.getId());
  const parents = file.getParents();
  if (!parents.hasNext()) throw new Error('マスタの置き場所が見つかりません');
  const root = parents.next();

  const outFolder = getOrCreateFolder_(root, '利用契約書');
  const tplFolder = getOrCreateFolder_(root, 'テンプレート');

  // テンプレートを複製（既にあれば使う）
  let tplFile;
  const it = tplFolder.getFilesByName('らふたす_契約書類一式');
  tplFile = it.hasNext() ? it.next() : DriveApp.getFileById(TEMPLATE_SOURCE_ID).makeCopy('らふたす_契約書類一式', tplFolder);

  PropertiesService.getScriptProperties().setProperty('OUTPUT_FOLDER_ID', outFolder.getId());

  buildHowto_(ss);
  buildMasterSheet_(ss, SHEET_COMMON, '法人共通', [
    ['法人_名称', 'ふわりの森合同会社', ''],
    ['法人_代表者役職', '代表社員', ''],
    ['法人_代表者名', '山本 洋子', '']
  ]);
  buildMasterSheet_(ss, SHEET_KYOTAKU, '居宅介護支援', [
    ['居宅_事業所名', '居宅介護支援事業所らふたす', ''],
    ['居宅_郵便番号', '811-2209', ''],
    ['居宅_所在地', '福岡県糟屋郡志免町王子3-22-3', ''],
    ['居宅_指定番号', '福岡県 4074000763号', '重要事項説明書「介護保険指定番号」'],
    ['居宅_実施地域', '志免町、須恵町、篠栗町、宇美町、粕屋町、福岡市博多区・東区の一部', ''],
    ['居宅_電話番号', '092-935-1788', ''],
    ['居宅_営業日', '月曜日から土曜日', ''],
    ['居宅_休業日', '原則として日・祝日及び盆(8月13〜15日)・年末年始(12月29日〜1月3日)を除く', ''],
    ['居宅_営業時間', '平日10:00～19:00 / 土曜日 9:00～12:00', ''],
    ['居宅_相談担当者', '山本 洋子', '相談・苦情の窓口'],
    ['居宅_相談対応時間', '平日10時00分～19時00分', ''],
    ['居宅_管理者名', '山本 洋子', ''],
    ['居宅_虐待防止担当者', '山本 洋子', ''],
    ['居宅_説明者候補', '山本 洋子', '書類発行の「説明者」に出る名前。複数は「、」で区切る']
  ]);
  buildTemplateSheet_(ss, [['契約書類一式', tplFile.getUrl(), '{{利用者_氏名}}_契約書類一式']]);

  // 不要なシートを消す
  ss.getSheets().forEach(function (sh) {
    if ([SHEET_HOWTO, SHEET_COMMON, SHEET_KYOTAKU, SHEET_TPL].indexOf(sh.getName()) < 0) ss.deleteSheet(sh);
  });
  ss.setActiveSheet(ss.getSheetByName(SHEET_HOWTO));
  Logger.log('OUTPUT_FOLDER_ID=' + outFolder.getId() + ' / TEMPLATE=' + tplFile.getId());
}

function getOrCreateFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function buildHowto_(ss) {
  const sh = getOrCreateSheet_(ss, SHEET_HOWTO);
  sh.clear();
  const rows = [
    ['そのばサイン　契約書類 かんたん作成シート'],
    [''],
    ['■ ふだんの使い方'],
    ['1. Webアプリ（そのばサイン）をタブレットで開く'],
    ['2.「書類発行」タブで利用者名・日付などを入れて「書類をつくる」を押す'],
    ['3. できた書類を画面で見せながら説明する'],
    ['4.「サイン」タブで利用者を選び、書類を選んで、その場でサインしてもらう'],
    ['5. サイン済みのPDFが 利用契約書 ＞ 利用者名_日付 ＞ 02_サイン済みPDF に保存される'],
    [''],
    ['■ 事業所の情報が変わったとき'],
    ['「マスター_共通」「マスター_居宅」の黄色いセルだけ直す（Webアプリの「事業所情報」タブからも直せます）'],
    ['タグ名の列と「テンプレート（COCOiRO管理）」のタブは触らない'],
    ['数字や英字は半角で入れてOK。書類では全角になります'],
    [''],
    ['■ 困ったとき'],
    ['COCOiRO（田村）に連絡してください']
  ];
  sh.getRange(1, 1, rows.length, 1).setValues(rows);
  sh.getRange('A1').setFontSize(16).setFontWeight('bold');
  [3, 10, 15].forEach(function (r) { sh.getRange(r, 1).setFontWeight('bold'); });
  sh.setColumnWidth(1, 760);
  sh.setHiddenGridlines(true);
}

function buildMasterSheet_(ss, name, label, rows) {
  const sh = getOrCreateSheet_(ss, name);
  sh.clear();
  sh.getRange('A1').setValue('そのばサイン　' + label).setFontSize(14).setFontWeight('bold');
  sh.getRange('A2').setValue('黄色いセルだけ直してください。数字・英字は半角でOKです。');
  sh.getRange(3, 1, 1, 3).setValues([['タグ名（触らない）', '値（ここを直す）', 'メモ']])
    .setFontWeight('bold').setBackground('#e0e0e0');
  sh.getRange(4, 1, rows.length, 3).setValues(rows);
  sh.getRange(4, 1, rows.length, 1).setBackground('#f3f3f3').setFontColor('#666666');
  sh.getRange(4, 2, rows.length, 1).setBackground('#fff7c2').setWrap(true);
  sh.getRange(4, 3, rows.length, 1).setFontColor('#666666').setWrap(true);
  sh.setColumnWidth(1, 200); sh.setColumnWidth(2, 460); sh.setColumnWidth(3, 300);
  sh.setFrozenRows(3);
  const prot = sh.getRange(1, 1, rows.length + 3, 1).protect();
  prot.setWarningOnly(true).setDescription('タグ名は触らない');
}

function buildTemplateSheet_(ss, rows) {
  const sh = getOrCreateSheet_(ss, SHEET_TPL);
  sh.clear();
  sh.getRange('A1').setValue('テンプレート（COCOiRO管理）').setFontSize(14).setFontWeight('bold');
  sh.getRange('A2').setValue('このタブは触らないでください。');
  sh.getRange(3, 1, 1, 3).setValues([['書類名', 'テンプレートURL', '出力ファイル名']])
    .setFontWeight('bold').setBackground('#e0e0e0');
  sh.getRange(4, 1, rows.length, 3).setValues(rows);
  sh.setColumnWidth(1, 160); sh.setColumnWidth(2, 460); sh.setColumnWidth(3, 260);
  sh.setTabColor('#999999');
  sh.protect().setWarningOnly(true).setDescription('COCOiRO管理');
}
