// そのばサイン 組み立て：共通の本体(core) ＋ オプション ＋ 会社ごとの設定 → dist/<会社>/{app,remote}
// 使い方: node tools/build.mjs solrian
import fs from "fs"; import path from "path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const name = process.argv[2];
if (!name) { console.error("会社名を指定してください: node tools/build.mjs solrian"); process.exit(1); }
const cust = JSON.parse(fs.readFileSync(path.join(ROOT, "customers", name, "customer.json"), "utf8"));
const copyDir = (src, dst) => { if (!fs.existsSync(src)) return; for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f)); };

for (const part of ["app", "remote"]) {
  if (!cust[part]) continue;
  const out = path.join(ROOT, "dist", name, part);
  fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  copyDir(path.join(ROOT, "core", part), out);
  copyDir(path.join(ROOT, "customers", name, part), out);
  if (part === "app") {
    let html = fs.readFileSync(path.join(out, "index.html"), "utf8");
    const slots = { form: "<!--@@OPTION:form-->", script: "/*@@OPTION:script*/" };
    const fill = { form: "", script: "" };
    for (const opt of cust.options || []) {
      const dir = path.join(ROOT, "options", opt);
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith(".js")) fs.copyFileSync(path.join(dir, f), path.join(out, "opt_" + opt + "_" + f));
      }
      for (const k of Object.keys(slots)) {
        const p = path.join(dir, k + ".html");
        if (fs.existsSync(p)) fill[k] += fs.readFileSync(p, "utf8");
      }
    }
    for (const k of Object.keys(slots)) {
      if (html.split(slots[k]).length !== 2) throw new Error("index.html の差し込み口が見つかりません: " + slots[k]);
      html = html.replace(slots[k], () => fill[k]);
    }
    fs.writeFileSync(path.join(out, "index.html"), html);
  }
  // config.js を最初に読み込ませる
  const files = fs.readdirSync(out).filter(f => f.endsWith(".js"));
  const order = ["config.js", ...files.filter(f => f !== "config.js")];
  fs.writeFileSync(path.join(out, ".clasp.json"), JSON.stringify({ scriptId: cust[part].scriptId, rootDir: ".", filePushOrder: order }, null, 2));
  console.log(part + ": " + fs.readdirSync(out).join(", "));
}
