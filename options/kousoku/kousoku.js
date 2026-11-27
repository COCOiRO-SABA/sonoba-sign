// ============================================================
// 身体拘束の説明・同意書と経過表（2026-11-23 COCOiRO v8）
// ・書類発行タブの「つくる書類」で切り替えて発行する
// ・説明・同意書：職員が発行時にすべて入力。ご本人かご家族等のどちらかが、日付を選んでサインするだけ
// ・経過表：スプレッドシート。1枚目（開始時の判断記録）は同意書と同じ入力から入る。2枚目（実施中の観察と解除）は都度入力
// ・書式のIDはスクリプトプロパティ（KOUSOKU_TEMPLATE_DOC_ID／KOUSOKU_TEMPLATE_SHEET_ID）
// ============================================================
const KOUSOKU_PROP_DOC = "KOUSOKU_TEMPLATE_DOC_ID";
const KOUSOKU_PROP_SHEET = "KOUSOKU_TEMPLATE_SHEET_ID";
const KOUSOKU_DOC_NAME = "身体拘束_説明・同意書";
const KOUSOKU_SHEET_NAME = "身体拘束_経過表";
const KOUSOKU_SHEET1 = "開始時の判断記録";
const KOUSOKU_SHEET2 = "実施中の観察と解除";

/** "■ A　□ B" の形にする */
function kousokuBox_(options, selected) {
  return options.map(function (o) { return (o === selected ? "■ " : "□ ") + o; }).join("　");
}

/** "2026-11-23T18:30" → "令和８年１１月２３日　１８時３０分"。空なら記入用の空欄 */
function kousokuDateTime_(v) {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (!m) return "　　　年　　　月　　　日　　　時　　　分";
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  let out = toWareki_(d);
  if (m[4] != null) out += "　" + parseInt(m[4], 10) + "時" + m[5] + "分";
  return toZenkaku_(out);
}

/** 置換後の文字として安全な形にする（$ と \ は置換で特別扱いされるため全角に） */
function kousokuSafe_(text) {
  return String(text == null ? "" : text).replace(/\$/g, "＄").replace(/\\/g, "＼");
}

function generateKousoku(form) {
  form = form || {};
  const s = function (k) { return String(form[k] == null ? "" : form[k]).trim(); };
  const z = function (k) { return toZenkaku_(s(k)); };
  const clientName = s("clientName");
  if (!clientName) throw new Error("利用者のお名前を入力してください。");
  const signer = form.signer === "代理人" ? "代理人" : "本人";
  const agentName = s("agentName");
  const agentRelation = s("agentRelation");
  if (signer === "代理人" && (!agentName || !agentRelation)) {
    throw new Error("サインするご家族等のお名前と続柄を入力してください。");
  }
  const props = PropertiesService.getScriptProperties();
  const tplDocId = props.getProperty(KOUSOKU_PROP_DOC);
  const tplSheetId = props.getProperty(KOUSOKU_PROP_SHEET);
  if (!tplDocId || !tplSheetId) throw new Error("身体拘束の書式がまだ準備されていません。COCOiROに連絡してください。");

  const office = getOffice_(form.office);
  const famMethod = s("famMethod");
  const famIntent = s("famIntent");
  const selfIntent = s("selfIntent");
  const v = {};
  v["拘束_事業所名"] = office.name;
  v["利用者_氏名"] = clientName;
  v["拘束_切迫性"] = z("seppaku");
  v["拘束_非代替性"] = z("hidaitai");
  v["拘束_方法"] = z("method");
  v["拘束_影響"] = z("effect");
  v["拘束_開始"] = kousokuDateTime_(s("startAt"));
  v["拘束_終了"] = kousokuDateTime_(s("endAt"));
  v["拘束_時間帯"] = z("timeBand");
  v["拘束_最長"] = z("maxMin");
  v["拘束_一時性"] = z("ichiji");
  v["拘束_見直し"] = kousokuDateTime_(s("reviewAt"));
  v["拘束_検討日時"] = kousokuDateTime_(s("meetAt"));
  v["拘束_参加者"] = z("members");
  v["拘束_管理者"] = z("manager");
  v["拘束_本人説明日時"] = kousokuDateTime_(s("selfAt"));
  v["拘束_本人説明者"] = z("selfBy");
  v["拘束_本人説明"] = kousokuBox_(["説明した", "説明が難しかった"], s("selfExplained"));
  v["拘束_本人意向"] = kousokuBox_(["同意する", "同意しない", "保留", "意向確認が難しい"], selfIntent);
  v["拘束_本人反応"] = z("selfReaction");
  v["拘束_家族説明日時"] = kousokuDateTime_(s("famAt"));
  v["拘束_家族方法"] = kousokuBox_(["対面", "電話"], famMethod) + "　" +
    (famMethod === "その他" ? "■ その他（" + z("famMethodOther") + "）" : "□ その他（　　　　　）");
  v["拘束_家族相手"] = z("famWho");
  v["拘束_家族説明者"] = z("famBy");
  v["拘束_電話日時"] = kousokuDateTime_(s("telAt"));
  v["拘束_電話相手"] = z("telWho");
  v["拘束_電話説明者"] = z("telBy");
  v["拘束_電話内容"] = z("telNote");
  v["拘束_家族意向"] = kousokuBox_(["同意する", "同意しない", "保留"], famIntent);
  v["拘束_再検討"] = z("reNote");
  v["拘束_再説明日時"] = kousokuDateTime_(s("reAt"));
  v["拘束_再説明状況"] = kousokuBox_(["予定", "実施"], s("reStatus"));
  v["拘束_再説明内容"] = z("reWho");

  // 署名欄：サインする側だけにサイン用のタグを残す。サイン時に入るのはサイン画像と署名日だけ
  const signCells = {};
  if (signer === "本人") {
    signCells["拘束_本人署名欄"] = "{{署名_利用者}}　　{{署名_日付}}";
    signCells["拘束_家族署名欄"] = "署名　　　　　　　　　　　　続柄　　　　　　　年　　月　　日";
  } else {
    signCells["拘束_本人署名欄"] = "";
    signCells["拘束_家族署名欄"] = "署名　{{署名_代理人}}　　続柄　" + toZenkaku_(agentRelation) + "　　{{署名_日付}}";
  }

  const stamp = todayStamp_();
  const folderName = clientName + "_身体拘束_" + stamp;
  const clientFolder = getOrCreateClientFolder_(office.key, folderName);
  const docFolder = getOrCreateSubFolder_(clientFolder, SUBFOLDER_DOCS);
  getOrCreateSubFolder_(clientFolder, SUBFOLDER_PDFS);

  // 説明・同意書
  const docName = KOUSOKU_DOC_NAME + "_" + clientName + "_" + stamp;
  const old = docFolder.getFilesByName(docName);
  while (old.hasNext()) old.next().setTrashed(true);
  const copy = DriveApp.getFileById(tplDocId).makeCopy(docName, docFolder);
  const doc = DocumentApp.openById(copy.getId());
  [doc.getBody(), doc.getHeader(), doc.getFooter()].forEach(function (section) {
    if (!section) return;
    Object.keys(signCells).forEach(function (tag) {
      section.replaceText(escapeRegex_("{{" + tag + "}}"), kousokuSafe_(signCells[tag]));
    });
    Object.keys(v).forEach(function (tag) {
      section.replaceText(escapeRegex_("{{" + tag + "}}"), kousokuSafe_(v[tag]));
    });
  });
  doc.saveAndClose();

  // 経過表（同じ日に発行し直したときは、2枚目の記録を残すため作り直さず1枚目だけ入れ直す）
  const sheetName = KOUSOKU_SHEET_NAME + "_" + clientName + "_" + stamp;
  const exist = clientFolder.getFilesByName(sheetName);
  const keikaFile = exist.hasNext() ? exist.next() : DriveApp.getFileById(tplSheetId).makeCopy(sheetName, clientFolder);
  fillKeika_(SpreadsheetApp.openById(keikaFile.getId()), v, {
    officeName: office.name, clientName: clientName,
    caseAt: kousokuDateTime_(s("caseAt")), casePlace: z("casePlace"), caseState: z("caseState"),
    decision: s("decision"), decider: z("decider"), observe: z("observe"),
    signer: signer, agentName: agentName, agentRelation: agentRelation,
    selfIntent: selfIntent, famIntent: famIntent, famMethod: famMethod, preNote: z("preNote")
  });

  const intent = signer === "本人" ? selfIntent : famIntent;
  clientFolder.setDescription(JSON.stringify({
    kind: "kousoku", office: office.key, clientName: clientName, signer: signer,
    agentName: agentName, agentRelation: agentRelation, intent: intent,
    keikaId: keikaFile.getId(), keikaUrl: keikaFile.getUrl()
  }));

  return {
    folderName: folderName, folderUrl: clientFolder.getUrl(),
    files: [{ name: docName, url: copy.getUrl() }, { name: sheetName, url: keikaFile.getUrl() }],
    errors: []
  };
}

/** 経過表の1枚目（開始時の判断記録）と、2枚目の見出しに値を入れる */
function fillKeika_(ss, v, x) {
  const head = "事業所名　" + x.officeName + "　　　利用者氏名　" + x.clientName + " 様";
  const s1 = ss.getSheetByName(KOUSOKU_SHEET1);
  const s2 = ss.getSheetByName(KOUSOKU_SHEET2);
  if (!s1 || !s2) throw new Error("経過表の書式が想定と違います。COCOiROに連絡してください。");
  const explain = [];
  if (x.selfIntent) explain.push("ご本人：" + v["拘束_本人説明日時"].trim() + "／説明者 " + v["拘束_本人説明者"] + "／意向 " + x.selfIntent);
  if (x.famMethod || x.famIntent) explain.push("ご家族等：" + v["拘束_家族説明日時"].trim() + "／相手 " + v["拘束_家族相手"] + "／説明者 " + v["拘束_家族説明者"] + "／方法 " + (x.famMethod || "－") + "／意向 " + (x.famIntent || "－"));
  if (x.preNote) explain.push("事前に説明できなかった理由・その後の経過：" + x.preNote);
  const rows = [
    x.caseAt + "　／　場所　" + x.casePlace,
    x.caseState,
    v["拘束_切迫性"],
    v["拘束_非代替性"],
    v["拘束_一時性"],
    "検討日時　" + v["拘束_検討日時"] + "\n参加者（職種・氏名）　" + v["拘束_参加者"],
    kousokuBox_(["実施を見送る", "時間を限って実施する"], x.decision) + "　　判断者　" + x.decider +
      "\n具体的方法・実施する場面・時間帯　" + v["拘束_方法"] + (v["拘束_時間帯"] ? "（" + v["拘束_時間帯"] + "）" : ""),
    "観察項目・間隔・担当者　" + x.observe + "\n次回検討日時　" + v["拘束_見直し"],
    explain.join("\n")
  ];
  s1.getRange(2, 1).setValue(head);
  s1.getRange(4, 2, rows.length, 1).setValues(rows.map(function (r) { return [r]; }));
  s2.getRange(2, 1).setValue(head);
  s2.getRange(3, 1).setValue("事例の発生日　" + x.caseAt.split("　")[0] + "　　　　記録日　　　　年　　月　　日　　　　　枚目");
  SpreadsheetApp.flush();
}

/** 経過表をPDFにして「02_サイン済みPDF」に保存する（解除時・途中経過の控え） */
function exportKeikaPdf(officeKey, folderName) {
  const folder = getOrCreateClientFolder_(officeKey, folderName);
  let meta = {};
  try { meta = JSON.parse(folder.getDescription() || "{}"); } catch (e) { meta = {}; }
  if (!meta.keikaId) throw new Error("この利用者フォルダには経過表がありません。");
  const pdfFolder = getOrCreateSubFolder_(folder, SUBFOLDER_PDFS);
  const src = DriveApp.getFileById(meta.keikaId);
  const name = src.getName() + "_記録" + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd_HHmm") + ".pdf";
  const pdf = pdfFolder.createFile(src.getAs("application/pdf").setName(name));
  return { name: name, url: pdf.getUrl() };
}

// ---------------- 初期設定（COCOiRO・最初に1回） ----------------

/** テンプレートの置き場所（契約書類のテンプレートと同じフォルダ） */
function kousokuTemplateFolder_() {
  const first = loadTemplates_()[0];
  return DriveApp.getFileById(extractDocId_(first.url)).getParents().next();
}

/** 説明・同意書のテンプレート（Googleドキュメント）の表にタグを入れる。件数が想定と違えば変更しない */
function tagKousokuTemplate_(docId) {
  const doc = DocumentApp.openById(docId);
  const body = doc.getBody();
  if (body.getText().indexOf("{{拘束_切迫性}}") >= 0) return "タグは設定済み";
  const map = [
    ["差し迫った危険", "{{拘束_切迫性}}"],
    ["ほかに試した対応", "{{拘束_非代替性}}"],
    ["目的と具体的な方法", "{{拘束_方法}}"],
    ["予想される心身への影響", "{{拘束_影響}}"],
    ["実施を予定する期間", "開始　{{拘束_開始}}\n終了　{{拘束_終了}}まで\n時間帯　{{拘束_時間帯}}　　　１回最長　{{拘束_最長}}分"],
    ["最短とする根拠", "{{拘束_一時性}}"],
    ["次に見直す日時", "{{拘束_見直し}}"],
    ["事業所で検討した日時", "{{拘束_検討日時}}"],
    ["参加者", "{{拘束_参加者}}"],
    ["管理者氏名", "{{拘束_管理者}}"],
    ["ご本人への説明日時", "{{拘束_本人説明日時}}\n説明者（職種・氏名）　{{拘束_本人説明者}}"],
    ["ご本人への説明・意向", "{{拘束_本人説明}}\n{{拘束_本人意向}}"],
    ["ご本人署名", "{{拘束_本人署名欄}}"],
    ["ご本人の言葉・表情等", "{{拘束_本人反応}}"],
    ["ご家族等への説明", "説明日時　{{拘束_家族説明日時}}\n方法　{{拘束_家族方法}}\n相手・続柄　{{拘束_家族相手}}　　　説明者　{{拘束_家族説明者}}"],
    ["電話で先に説明した場合", "電話日時　{{拘束_電話日時}}\n相手・続柄　{{拘束_電話相手}}　　　説明者　{{拘束_電話説明者}}\n説明した内容・ご意向・質問等　{{拘束_電話内容}}"],
    ["ご家族等の意向・署名", "今回の対応について説明を受けました。\n{{拘束_家族意向}}\n{{拘束_家族署名欄}}"],
    ["ご意向と再検討の結果", "{{拘束_再検討}}"],
    ["再説明の予定・結果", "日時　{{拘束_再説明日時}}　{{拘束_再説明状況}}\n相手・説明者・回答　{{拘束_再説明内容}}"]
  ];
  const norm = function (t) { return String(t).replace(/[\s　]/g, ""); };
  const rows = [];
  body.getTables().forEach(function (table) {
    for (let r = 0; r < table.getNumRows(); r++) {
      const row = table.getRow(r);
      if (row.getNumCells() >= 2) rows.push({ label: norm(row.getCell(0).getText()), row: row });
    }
  });
  const plan = [];
  const problems = [];
  map.forEach(function (m) {
    const hit = rows.filter(function (x) { return x.label.indexOf(norm(m[0])) === 0; });
    if (hit.length !== 1) problems.push(m[0] + "：" + hit.length + "件");
    else plan.push({ row: hit[0].row, text: m[1] });
  });
  const headRe = "事業所名[ 　_]+利用者氏名[ 　_]+様";
  let heads = 0;
  let f = body.findText(headRe);
  while (f) { heads++; f = body.findText(headRe, f); }
  if (heads !== 2) problems.push("事業所名・利用者氏名の行：" + heads + "件");
  if (problems.length) throw new Error("テンプレートが想定と違うため変更しませんでした → " + problems.join("、"));

  plan.forEach(function (p) {
    const labelText = p.row.getCell(0).editAsText();
    const font = labelText.getFontFamily(0);
    const size = labelText.getFontSize(0);
    const cell = p.row.getCell(1);
    cell.setText(p.text);
    const t = cell.editAsText();
    if (font) t.setFontFamily(font);
    if (size) t.setFontSize(size);
    t.setBold(false);
  });
  body.replaceText(headRe, "事業所名　{{拘束_事業所名}}　　　利用者氏名　{{利用者_氏名}} 様");
  doc.saveAndClose();
  return "タグを設定：" + plan.length + "欄、見出し" + heads + "か所";
}

/** 経過表のテンプレート（スプレッドシート）をつくる */
function buildKeikaTemplate_(folder) {
  const ss = SpreadsheetApp.create(KOUSOKU_SHEET_NAME + "_テンプレート");
  const gray = "#e8eaed";
  const line = "#9aa0a6";

  const s1 = ss.getSheets()[0].setName(KOUSOKU_SHEET1);
  s1.setColumnWidth(1, 190); s1.setColumnWidth(2, 560);
  s1.getRange("A1:B1").merge().setValue("身体拘束経過表　開始時の判断記録").setFontSize(15).setFontWeight("bold").setHorizontalAlignment("center");
  s1.getRange("A2:B2").merge().setValue("事業所名　　　　　　　　　　　　　　　　利用者氏名　　　　　　　　　　　　　様");
  s1.getRange("A3:B3").merge().setValue("一つの事例につき１枚作成します。実施した各回の開始・終了時刻と観察内容は、次ページの経過記録に記入してください。").setWrap(true);
  s1.setRowHeight(1, 40); s1.setRowHeight(3, 44);
  const labels1 = ["事例の発生日・場所", "発生時の心身の状態\nご本人の言葉・反応", "切迫性", "非代替性", "一時性", "事業所としての検討", "決定内容・判断者", "観察・再検討の予定", "ご本人・ご家族等への説明"];
  const heights1 = [40, 90, 90, 110, 90, 70, 80, 70, 100];
  s1.getRange(4, 1, labels1.length, 1).setValues(labels1.map(function (l) { return [l]; })).setBackground(gray).setFontWeight("bold");
  heights1.forEach(function (h, i) { s1.setRowHeight(4 + i, h); });
  s1.getRange(4, 1, labels1.length, 2).setBorder(true, true, true, true, true, true, line, SpreadsheetApp.BorderStyle.SOLID).setVerticalAlignment("top").setWrap(true);
  s1.getRange(4, 1, labels1.length, 1).setVerticalAlignment("middle");
  if (s1.getMaxColumns() > 2) s1.deleteColumns(3, s1.getMaxColumns() - 2);
  if (s1.getMaxRows() > 13) s1.deleteRows(14, s1.getMaxRows() - 13);
  s1.setHiddenGridlines(true);

  const s2 = ss.insertSheet(KOUSOKU_SHEET2);
  [125, 165, 205, 185, 80].forEach(function (w, i) { s2.setColumnWidth(i + 1, w); });
  s2.getRange("A1:E1").merge().setValue("身体拘束経過表　実施中の観察と解除").setFontSize(15).setFontWeight("bold").setHorizontalAlignment("center");
  s2.getRange("A2:E2").merge().setValue("事業所名　　　　　　　　　　　　　　　　利用者氏名　　　　　　　　　　　　　様");
  s2.getRange("A3:E3").merge().setValue("事例の発生日　　　　年　　月　　日　　　　記録日　　　　年　　月　　日　　　　　枚目");
  s2.getRange("A4:E4").merge().setValue("開始・一時解除・再開・終了のたびに実際の時刻を記入します。継続・再開時は、３要件をなお満たす具体的な根拠を残します。記入欄が足りない場合は、行を追加してください。").setWrap(true);
  s2.setRowHeight(1, 40); s2.setRowHeight(4, 44);
  s2.getRange("A5:E5").setValues([["日時", "実施状況・方法", "心身の状態・本人の訴え\n試した対応とその結果", "継続・解除の判断と根拠\n次の確認時刻", "記録者"]]).setBackground(gray).setFontWeight("bold").setVerticalAlignment("middle").setWrap(true);
  s2.setRowHeight(5, 44);
  const n = 10;
  for (let i = 0; i < n; i++) s2.setRowHeight(6 + i, 46);
  s2.getRange(5, 1, n + 1, 5).setBorder(true, true, true, true, true, true, line, SpreadsheetApp.BorderStyle.SOLID).setWrap(true);
  s2.getRange(6, 1, n, 5).setVerticalAlignment("top");
  const r0 = 6 + n + 1;
  s2.getRange(r0, 1, 1, 5).merge().setValue("再検討・最終解除の記録").setFontWeight("bold");
  const labels2 = ["再検討日時・参加者", "検討結果と理由", "最終解除", "解除後の支援", "ご本人・ご家族等への報告"];
  const hints2 = [
    "　　　年　　月　　日　　時　　分\n参加者（職種・氏名）",
    "□ 継続　□ 方法変更　□ 解除　　判断者\n判断の根拠・次回検討日時",
    "　　　年　　月　　日　　時　　分　　解除時のご本人の状態",
    "",
    "　　　年　　月　　日　　時　　分　　相手・報告者・反応"
  ];
  labels2.forEach(function (l, i) {
    const r = r0 + 1 + i;
    s2.getRange(r, 1).setValue(l).setBackground(gray).setFontWeight("bold").setVerticalAlignment("middle").setWrap(true);
    s2.getRange(r, 2, 1, 4).merge().setValue(hints2[i]).setVerticalAlignment("top").setWrap(true);
    s2.setRowHeight(r, 54);
  });
  s2.getRange(r0 + 1, 1, labels2.length, 5).setBorder(true, true, true, true, true, true, line, SpreadsheetApp.BorderStyle.SOLID);
  if (s2.getMaxColumns() > 5) s2.deleteColumns(6, s2.getMaxColumns() - 5);
  const last = r0 + labels2.length;
  if (s2.getMaxRows() > last + 1) s2.deleteRows(last + 2, s2.getMaxRows() - last - 1);
  s2.setHiddenGridlines(true);
  SpreadsheetApp.flush();
  DriveApp.getFileById(ss.getId()).moveTo(folder);
  return ss.getId();
}

/** 【COCOiRO・最初に1回】身体拘束の書式を準備する。何度実行しても同じ結果になる */
function setupKousoku() {
  const props = PropertiesService.getScriptProperties();
  const folder = kousokuTemplateFolder_();
  const log = ["テンプレートの置き場所：" + folder.getName()];
  let docId = props.getProperty(KOUSOKU_PROP_DOC);
  if (!docId) {
    if (typeof KOUSOKU_DOCX_B64 === "undefined") throw new Error("元のWordファイルが渡されていません。");
    const blob = Utilities.newBlob(Utilities.base64Decode(KOUSOKU_DOCX_B64),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", KOUSOKU_DOC_NAME + ".docx");
    const docx = folder.createFile(blob);
    docId = convertDocxToDoc_(docx, KOUSOKU_DOC_NAME + "_テンプレート");
    DriveApp.getFileById(docId).moveTo(folder);
    docx.setTrashed(true);
    props.setProperty(KOUSOKU_PROP_DOC, docId);
    log.push("説明・同意書を変換：" + docId);
  } else log.push("説明・同意書は準備済み：" + docId);
  log.push(tagKousokuTemplate_(docId));
  let sheetId = props.getProperty(KOUSOKU_PROP_SHEET);
  if (!sheetId) {
    sheetId = buildKeikaTemplate_(folder);
    props.setProperty(KOUSOKU_PROP_SHEET, sheetId);
    log.push("経過表を作成：" + sheetId);
  } else log.push("経過表は準備済み：" + sheetId);
  Logger.log(log.join("\n"));
}

// ---------------- 経過表への記録（2026-11-23 COCOiRO v9：アプリの入力欄から経過表に入れる） ----------------

/** 利用者フォルダの経過表（2枚目）を開く */
function keikaSheet_(officeKey, folderName) {
  const folder = getOrCreateClientFolder_(officeKey, folderName);
  let meta = {};
  try { meta = JSON.parse(folder.getDescription() || "{}"); } catch (e) { meta = {}; }
  if (!meta.keikaId) throw new Error("この利用者フォルダには経過表がありません。");
  const sheet = SpreadsheetApp.openById(meta.keikaId).getSheetByName(KOUSOKU_SHEET2);
  if (!sheet) throw new Error("経過表の書式が想定と違います。COCOiROに連絡してください。");
  return sheet;
}

/** 経過表2枚目の形（記録の行の範囲と、再検討・最終解除の欄の行）を調べる */
function keikaLayout_(sheet) {
  const colA = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues().map(function (r) { return String(r[0]).replace(/\s/g, ""); });
  const head = colA.indexOf("日時") + 1;
  const review = colA.indexOf("再検討・最終解除の記録") + 1;
  if (!head || !review || review <= head + 1) throw new Error("経過表の書式が想定と違います。COCOiROに連絡してください。");
  const labels = {};
  for (let r = review + 1; r <= colA.length; r++) if (colA[r - 1]) labels[colA[r - 1]] = r;
  return { first: head + 1, last: review - 2, review: review, labels: labels };
}

/** サイン画面用：記録済みの経過（新しい順に見せるための一覧） */
function getKeikaRows(officeKey, folderName) {
  const sheet = keikaSheet_(officeKey, folderName);
  const lay = keikaLayout_(sheet);
  const values = sheet.getRange(lay.first, 1, lay.last - lay.first + 1, 5).getDisplayValues();
  const rows = values.filter(function (r) { return r.join("").trim() !== ""; });
  return { rows: rows };
}

/** 経過を1行記録する（空いている行へ。足りなければ行を足す） */
function addKeikaRow(officeKey, folderName, x) {
  x = x || {};
  const s = function (k) { return String(x[k] == null ? "" : x[k]).trim(); };
  if (!s("at")) throw new Error("日時を入力してください。");
  if (!s("by")) throw new Error("記録者を入力してください。");
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = keikaSheet_(officeKey, folderName);
    const lay = keikaLayout_(sheet);
    const values = sheet.getRange(lay.first, 1, lay.last - lay.first + 1, 5).getValues();
    let row = 0;
    for (let i = 0; i < values.length; i++) {
      if (values[i].join("").trim() === "") { row = lay.first + i; break; }
    }
    if (!row) {
      sheet.insertRowAfter(lay.last);
      row = lay.last + 1;
      // 足した行は、1行目の記録行と同じ罫線・書式にする
      sheet.getRange(lay.first, 1, 1, 5).copyTo(sheet.getRange(row, 1, 1, 5), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      sheet.setRowHeight(row, sheet.getRowHeight(lay.first));
    }
    const status = s("status");
    const method = toZenkaku_(s("method"));
    const judge = toZenkaku_(s("judge"));
    const next = toZenkaku_(s("next"));
    sheet.getRange(row, 1, 1, 5).setValues([[
      kousokuDateTime_(s("at")).replace("　", "\n"),
      [status, method].filter(String).join("："),
      toZenkaku_(s("state")),
      [judge, next ? "次の確認　" + next : ""].filter(String).join("\n"),
      toZenkaku_(s("by"))
    ]]);
    SpreadsheetApp.flush();
    return getKeikaRows(officeKey, folderName);
  } finally {
    lock.releaseLock();
  }
}

/** 再検討・最終解除の欄を記録する（入力した欄だけ書き換える。再検討は経過の行にも残す） */
function saveKeikaReview(officeKey, folderName, x) {
  x = x || {};
  const s = function (k) { return String(x[k] == null ? "" : x[k]).trim(); };
  const z = function (k) { return toZenkaku_(s(k)); };
  const sheet = keikaSheet_(officeKey, folderName);
  const lay = keikaLayout_(sheet);
  const set = function (label, text) {
    const r = lay.labels[label];
    if (!r) throw new Error("経過表に「" + label + "」の欄が見つかりません。COCOiROに連絡してください。");
    sheet.getRange(r, 2).setValue(text);
  };
  let done = 0;
  const hasReview = s("at") || s("members") || s("result") || s("decider") || s("basis");
  if (hasReview) {
    set("再検討日時・参加者", kousokuDateTime_(s("at")) + "\n参加者（職種・氏名）　" + z("members"));
    set("検討結果と理由", kousokuBox_(["継続", "方法変更", "解除"], s("result")) + "　　判断者　" + z("decider") + "\n判断の根拠・次回検討日時　" + z("basis"));
    done++;
  }
  if (s("endAt") || s("endState")) {
    set("最終解除", kousokuDateTime_(s("endAt")) + "　　解除時のご本人の状態　" + z("endState"));
    done++;
  }
  if (s("after")) { set("解除後の支援", z("after")); done++; }
  if (s("repAt") || s("repNote")) {
    set("ご本人・ご家族等への報告", kousokuDateTime_(s("repAt")) + "　　相手・報告者・反応　" + z("repNote"));
    done++;
  }
  if (!done) throw new Error("記録する内容を入力してください。");
  SpreadsheetApp.flush();
  if (hasReview && s("at") && s("by")) {
    addKeikaRow(officeKey, folderName, {
      at: s("at"), status: "再検討" + (s("result") ? "（" + s("result") + "）" : ""), method: "",
      state: s("members") ? "参加者　" + s("members") : "", judge: s("basis"), next: "", by: s("by")
    });
  }
  return { saved: done, rows: getKeikaRows(officeKey, folderName).rows };
}

