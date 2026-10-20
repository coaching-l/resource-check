// 外部への通信をしないこと・保存先が localStorage だけであることを、ファイルの中身から確かめるテスト
// （ブラウザでの確認は README の「ローカルでの動作確認」を参照）
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CONTENT = require("../content.js");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const FILES = ["index.html", "style.css", "content.js", "scoring.js", "app.js"];

test("Content-Security-Policy で、ページ自身のファイル以外への接続を禁止している", () => {
  const html = read("index.html");
  const m = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(m, "CSP がありません");
  assert.ok(m[1].includes("default-src 'none'"));
  ["script-src 'self'", "style-src 'self'", "img-src 'self'", "form-action 'none'"].forEach((d) => assert.ok(m[1].includes(d), d));
  assert.ok(!/connect-src/.test(m[1]), "connect-src は許可しない");
});

test("index.html が読み込むファイルは、すべてこのリポジトリの中のもの", () => {
  const html = read("index.html");
  const refs = Array.from(html.matchAll(/\s(?:src|href)="([^"]+)"/g), (m) => m[1]);
  assert.ok(refs.length > 0);
  refs.forEach((r) => {
    assert.ok(!/^(https?:)?\/\//.test(r), `外部の URL：${r}`);
    assert.ok(fs.existsSync(path.join(ROOT, r.replace(/\?.*$/, ""))), `ファイルがありません：${r}`);
  });
});

test("通信や外部読み込みの仕組みを使っていない", () => {
  const banned = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /EventSource/, /importScripts/, /\bimport\s*\(/, /serviceWorker/, /new\s+Image\s*\(/, /@import/, /url\(\s*["']?https?:/];
  FILES.forEach((f) => {
    const src = read(f);
    banned.forEach((re) => assert.ok(!re.test(src), `${f} に ${re}`));
  });
});

test("外部の URL は、結びの案内の2つのリンク（押したときだけ開く）だけ", () => {
  const allowed = new Set(CONTENT.closing.links.map((l) => l.url));
  assert.deepEqual([...allowed], ["https://coaching-l.net/integrated-personal-coaching/", "https://coaching-l.net/briefing-session/"]);
  FILES.forEach((f) => {
    // コメントの中の URL は数えない
    const src = read(f).replace(/<!--[\s\S]*?-->/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const urls = src.match(/https?:\/\/[^\s"'`)<]+/g) || [];
    urls.forEach((u) => assert.ok(allowed.has(u), `${f} に外部の URL：${u}`));
  });
});

test("保存先は localStorage の1つのキーだけ（Cookie・sessionStorage・IndexedDB は使わない）", () => {
  const app = read("app.js");
  assert.ok(app.includes('const STORAGE_KEY = "coachingl-resource-check-v1"'));
  FILES.forEach((f) => {
    const src = read(f);
    ["document.cookie", "sessionStorage", "indexedDB"].forEach((w) => assert.ok(!src.includes(w), `${f} に ${w}`));
  });
  const keys = Array.from(app.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(([^,)]+)/g), (m) => m[1].trim());
  keys.forEach((k) => assert.ok(/^STORAGE_KEY/.test(k), `STORAGE_KEY 以外のキー：${k}`));
});
