// content.js の文言が SPEC.md と同じかを確かめるテスト
// SPEC.md を読み込んで、質問・問い・参考文献などを一字一句くらべます。
// 文言を SPEC.md から変えたいときは、SPEC.md も同じように直してください（このテストが教えてくれます）。
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const CONTENT = require("../content.js");

const ROOT = path.join(__dirname, "..");
const SPEC = fs.readFileSync(path.join(ROOT, "SPEC.md"), "utf8");
const LINES = SPEC.split(/\r?\n/);

/** 見出し（完全一致）のあとから、次の見出しまでの番号付きの行（"1. …"）を取り出す */
function numberedAfter(heading) {
  const start = LINES.indexOf(heading);
  assert.ok(start >= 0, `SPEC.md に見出し「${heading}」がありません`);
  const items = [];
  for (let i = start + 1; i < LINES.length && !/^#/.test(LINES[i]); i++) {
    const m = LINES[i].match(/^\d+\.\s(.+)$/);
    if (m) items.push(m[1]);
  }
  return items;
}

/** SPEC.md の中に「…」の形でそのまま書かれているか */
function assertQuoted(value, label) {
  assert.ok(SPEC.includes("「" + value + "」"), `${label} が SPEC.md の「」の中と一字一句同じではありません：${value}`);
}

/** content.js の文字をすべて集める（参考文献は英語なので除く） */
function allStrings(node, out, key) {
  if (key === "references") return out;
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) node.forEach((v) => allStrings(v, out));
  else if (node && typeof node === "object") Object.keys(node).forEach((k) => allStrings(node[k], out, k));
  return out;
}

test("20問の質問と（逆）の印が SPEC.md と同じ", () => {
  CONTENT.domains.forEach((d, i) => {
    const spec = numberedAfter(`#### 領域${i + 1}：${d.name}`);
    assert.equal(spec.length, d.questions.length, d.name);
    d.questions.forEach((q, j) => {
      const reverse = spec[j].endsWith("（逆）");
      const text = spec[j].replace(/（逆）$/, "");
      assert.equal(q.text, text, `${d.name} ${j + 1}`);
      assert.equal(Boolean(q.reverse), reverse, `${d.name} ${j + 1} の（逆）`);
      assert.ok(!q.text.includes("（逆）"), "（逆）の印は画面に出さない");
    });
  });
});

test("5段階の答えが SPEC.md と同じ", () => {
  const line = CONTENT.scale.map((s) => `${s.value} ${s.label}`).join("／");
  assert.ok(SPEC.includes(line), line);
  assert.deepEqual(
    CONTENT.scale.map((s) => s.value),
    [1, 2, 3, 4, 5]
  );
});

test("ふりかえりの問い（5領域×3問）が SPEC.md と同じ", () => {
  CONTENT.domains.forEach((d) => {
    const spec = numberedAfter(`#### ${d.name}`);
    assert.equal(spec.length, d.reflection.length, d.name);
    d.reflection.forEach((p, j) => {
      // 選択肢のある問いは、SPEC.md では「問い（選択肢／選択肢…）」の形
      const text = p.choices ? `${p.text}（${p.choices.join("／")}）` : p.text;
      assert.equal(text, spec[j], `${d.name} の問い${j + 1}`);
    });
  });
});

test("参考文献が SPEC.md と一字一句同じ", () => {
  const start = LINES.findIndex((l) => l.startsWith("- 参考文献"));
  assert.ok(start >= 0);
  const spec = [];
  for (let i = start + 1; i < LINES.length && LINES[i].startsWith("  - "); i++) spec.push(LINES[i].slice(4));
  assert.equal(spec.length, 6);
  assert.deepEqual(CONTENT.about.references, spec);
});

test("画面の文言のうち、SPEC.md に「」で書かれたものは一字一句同じ", () => {
  const C = CONTENT;
  assertQuoted(C.start.intro, "スタートの説明文");
  assertQuoted(C.start.notDiagnosis.replace(/。$/, ""), "診断ではないことの明記");
  assertQuoted(C.result.title, "結果のタイトル");
  assertQuoted(C.result.disclaimer, "結果の注意書き");
  assertQuoted(C.result.supportNote, "専門家への相談の一文");
  assertQuoted(C.reflect.paperGuide, "ふりかえりの冒頭の案内");
  assertQuoted(C.step.question, "小さな一歩の問い");
  assertQuoted(C.summary.again, "1か月後の案内");
  assertQuoted(C.closing.title, "結びの見出し");
  assertQuoted(C.closing.body, "結びの本文");
  assertQuoted(C.about.body, "背景の本文");
  assertQuoted(C.common.privacy, "フッターのプライバシーの一文");
  ["charged", "even", "leaking"].forEach((k) => assert.ok(SPEC.includes(C.result.status[k]), k));
});

test("名前・副題・背景の考え方・結びのリンクが SPEC.md と同じ", () => {
  const C = CONTENT;
  assert.ok(SPEC.includes(`- 名前：${C.meta.title}\n`));
  assert.ok(SPEC.includes(`- 副題：${C.meta.subtitle}\n`));
  assert.ok(SPEC.includes(`- ${C.about.overallLabel}：${C.about.overall}\n`));
  assert.ok(SPEC.includes(`- ${C.about.basisLabel}：${C.about.basis.join("／")}\n`));
  C.closing.links.forEach((l) => assert.ok(SPEC.includes(`  - ${l.label} ${l.url}\n`), l.label));
  assert.ok(C.start.duration.includes("約5分＋ふりかえり5分"));
});

test("使わない言葉：「判定」「科学的に測定」は使わず、「診断」は「診断ではなく」の形だけ", () => {
  const texts = allStrings(CONTENT, []);
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const sources = texts.concat([html]);
  sources.forEach((s) => {
    assert.ok(!s.includes("判定"), s);
    assert.ok(!s.includes("科学的に測定"), s);
    assert.ok(!/診断(?!ではなく)/.test(s), s);
  });
});

test("文言の置き換え用の {名前} が、使う側とそろっている", () => {
  const C = CONTENT;
  assert.ok(C.result.best.includes("{name}"));
  assert.ok(C.result.worst.includes("{name}"));
  assert.ok(C.reflect.title.includes("{name}"));
  assert.ok(C.result.previousLegend.includes("{date}"));
  assert.ok(C.common.date.includes("{y}") && C.common.date.includes("{m}") && C.common.date.includes("{d}"));
});
