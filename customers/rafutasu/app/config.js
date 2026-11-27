/**
 * そのばサイン 会社ごとの設定(ふわりの森・居宅介護支援事業所らふたす)
 * 共通の本体(core)と組み合わせて配る。ここ以外の会社固有の値は、マスター(スプレッドシート)とスクリプトプロパティに置く。
 * 2026-11-27 COCOiRO：独自版(v3)から標準版へ移行。v3までのコードは _v3_before_standard/ に残してある(配布はしない)
 */
const CONFIG = {
  customer: "rafutasu",
  headerNote: "居宅介護支援事業所らふたす",
  guideTitle: "らふたす 契約書類 かんたん作成シート",
  officePhoneTag: "居宅_電話番号",          // 遠隔サインの文面に入れる事業所の電話(マスターのタグ名)
  explainTag: "居宅_説明方法の選択肢",       // 説明方法の選択肢(マスターのタグ名)
  explainerTag: "居宅_説明者候補",           // 説明者はこの候補(「、」区切り)から選ぶ
  simpleMenu: true,                           // スプレッドシートのメニューは「Webアプリを開く」だけ
  addressWithZip: true,                       // 利用者_住所 を「〒000-0000 住所」の形で印字
  hideFields: ["contractDate", "startDate"],  // 標準の「契約日」「利用開始予定日」は使わない
  // テンプレートのタグ名 → 標準のタグ名
  // ・契約締結日はサインした日(利用者・家族がサイン画面で選ぶ署名日)を入れる
  // ・代理人の続柄は標準の 署名_続柄 として扱う(本人がサインするときは空欄)
  tagAliases: { "契約日": "署名_日付", "代理人_続柄": "署名_続柄" },
  // らふたすの書類だけにある入力欄
  extraFields: [
    { id: "explainDate", label: "説明日", type: "date", tag: "説明日", today: true },
    { id: "termStart", label: "契約期間の開始日", type: "date", tag: "契約_開始日", today: true },
    { id: "termEnd", label: "契約期間の終了日(空欄なら日付なしで印字)", type: "date", tag: "契約_終了日" },
    { id: "receipt", label: "控えの受け取り方法", type: "choice", options: [
      { value: "紙", label: "紙で受け取る", tag: "受領_紙" },
      { value: "電子", label: "電子で受け取る", tag: "受領_電子" },
      { value: "相談", label: "相談して決める", tag: "受領_相談" }
    ] },
    { id: "contactName", label: "緊急連絡先：代表者名", type: "text", tag: "連絡先_代表者名", placeholder: "例）山田 花子" },
    { id: "contactTel", label: "緊急連絡先：電話番号", type: "tel", tag: "連絡先_電話番号", placeholder: "例）090-1234-5678" },
    { id: "contactMail", label: "緊急連絡先：メール(空欄可)", type: "email", tag: "連絡先_メール", raw: true }
  ]
};

const MASTER_SHEETS = [
  { name: "マスター_共通", color: "#616161", label: "法人共通" }
];

// 事業所は1つ。利用者フォルダは「利用契約書」の直下に置く(flat)
const OFFICES = [
  { key: "rafutasu", name: "居宅介護支援事業所らふたす", short: "らふたす", sheet: "マスター_居宅", flat: true }
];
const DEFAULT_OFFICE = "rafutasu";

// らふたすの書類には同意書の「する・しない」と写真の選択はない
const CONSENT_ITEMS = [];
const PHOTO_CHOICES = [];
