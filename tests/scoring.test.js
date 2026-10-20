// 採点が SPEC.md の「2. 採点」どおりかを確かめるテスト
// 実行：node --test tests/   （Node.js 18 以上。インストールするものはありません）
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const CONTENT = require("../content.js");
const Scoring = require("../scoring.js");

const DOMAINS = CONTENT.domains;
const ORDER = ["time", "focus", "emotion", "recovery", "priority"];

/** 全領域に同じ答えをそろえる */
function fill(value) {
  const a = {};
  DOMAINS.forEach((d) => (a[d.id] = d.questions.map(() => value)));
  return a;
}

/** 領域ごとの合計点（4〜20）から結果を出す */
function fromSums(sums) {
  return Scoring.scoreSums(DOMAINS, sums);
}

function sums(time, focus, emotion, recovery, priority) {
  return { time, focus, emotion, recovery, priority };
}

test("領域は SPEC.md の順（領域1→5）に5つ、各4問", () => {
  assert.deepEqual(
    DOMAINS.map((d) => d.id),
    ORDER
  );
  DOMAINS.forEach((d) => assert.equal(d.questions.length, 4, d.name));
});

test("逆転：（逆）の問いは 1→5、2→4、3→3、4→2、5→1。それ以外はそのまま", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((v) => Scoring.itemPoint(v, true)),
    [5, 4, 3, 2, 1]
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((v) => Scoring.itemPoint(v, false)),
    [1, 2, 3, 4, 5]
  );
  // 1〜5 以外は採点しない
  [0, 6, 2.5, "3", null, undefined].forEach((v) => assert.equal(Scoring.itemPoint(v, false), null));
});

test("逆転する問いは SPEC.md で（逆）が付いた7問だけ", () => {
  const reversed = [];
  DOMAINS.forEach((d) =>
    d.questions.forEach((q, i) => {
      if (q.reverse) reversed.push(d.id + (i + 1));
    })
  );
  assert.deepEqual(reversed, ["time3", "time4", "focus3", "emotion1", "emotion2", "emotion4", "priority3"]);
});

test("合計点ごとの得点・収支・区分（4問の平均、小数第1位まで四捨五入）", () => {
  // [合計点, 得点, 収支, 区分]。平均が 0.25 刻みになるので、.x5 は切り上げ（四捨五入）
  const table = [
    [4, "1.0", "−2.0", "leaking"],
    [5, "1.3", "−1.7", "leaking"], // 1.25
    [6, "1.5", "−1.5", "leaking"],
    [7, "1.8", "−1.2", "leaking"], // 1.75
    [8, "2.0", "−1.0", "leaking"],
    [9, "2.3", "−0.7", "leaking"], // 2.25
    [10, "2.5", "−0.5", "leaking"], // −0.5 以下は「漏れている」（境目）
    [11, "2.8", "−0.2", "even"], // 2.75
    [12, "3.0", "0.0", "even"],
    [13, "3.3", "+0.3", "even"], // 3.25
    [14, "3.5", "+0.5", "charged"], // ＋0.5 以上は「充電できている」（境目）
    [15, "3.8", "+0.8", "charged"], // 3.75
    [16, "4.0", "+1.0", "charged"],
    [17, "4.3", "+1.3", "charged"], // 4.25
    [18, "4.5", "+1.5", "charged"],
    [19, "4.8", "+1.8", "charged"], // 4.75
    [20, "5.0", "+2.0", "charged"],
  ];
  table.forEach(([sum, score, balance, status]) => {
    const r = fromSums(sums(sum, 12, 12, 12, 12))[0];
    assert.equal(r.score.toFixed(1), score, `合計${sum}の得点`);
    assert.equal(Scoring.formatBalance(r.balanceTenths), balance, `合計${sum}の収支`);
    assert.equal(r.status, status, `合計${sum}の区分`);
  });
});

test("全領域・全625通りの答えで、SPEC.md の手順で別に計算した値と一致する", () => {
  DOMAINS.forEach((domain) => {
    for (let n = 0; n < 625; n++) {
      const values = [0, 1, 2, 3].map((k) => (Math.floor(n / Math.pow(5, k)) % 5) + 1);
      // SPEC.md の手順をそのまま：逆転 → 合計 → 平均 → 小数第1位に四捨五入 → −3.0
      const points = values.map((v, i) => (domain.questions[i].reverse ? 6 - v : v));
      const sum = points.reduce((a, b) => a + b, 0);
      const avgHundredths = sum * 25; // 平均×100（4問なので 0.25 刻み）
      const scoreTenths = Math.floor((avgHundredths + 5) / 10); // 四捨五入
      const rawBalance = sum / 4 - 3; // 丸める前の収支
      const status = rawBalance >= 0.5 ? "charged" : rawBalance <= -0.5 ? "leaking" : "even";

      const answers = fill(3);
      answers[domain.id] = values;
      const r = Scoring.scoreAnswers(DOMAINS, answers).find((x) => x.id === domain.id);
      const label = `${domain.name} ${values.join(",")}`;
      assert.equal(r.sum, sum, label);
      assert.equal(r.scoreTenths, scoreTenths, label);
      assert.equal(r.balanceTenths, scoreTenths - 30, label);
      assert.ok(r.score >= 1 && r.score <= 5, label);
      assert.ok(r.balance >= -2 && r.balance <= 2, label);
      assert.equal(r.status, status, label);
    }
  });
});

test("全部「5 いつも」と答えたとき：逆転項目のある領域は下がる", () => {
  const r = Scoring.scoreAnswers(DOMAINS, fill(5));
  // 時間の主導権 5+5+1+1 / 集中の質 5+5+1+5 / 感情の消耗 1+1+5+1 / 回復の習慣 5+5+5+5 / 優先順位 5+5+1+5
  assert.deepEqual(
    r.map((x) => x.sum),
    [12, 16, 8, 20, 16]
  );
  assert.deepEqual(
    r.map((x) => Scoring.formatBalance(x.balanceTenths)),
    ["0.0", "+1.0", "−1.0", "+2.0", "+1.0"]
  );
  assert.deepEqual(
    r.map((x) => x.status),
    ["even", "charged", "leaking", "charged", "charged"]
  );
});

test("全部「1 ほとんどない」と答えたとき", () => {
  const r = Scoring.scoreAnswers(DOMAINS, fill(1));
  assert.deepEqual(
    r.map((x) => x.sum),
    [12, 8, 16, 4, 8]
  );
  assert.deepEqual(
    r.map((x) => x.status),
    ["even", "leaking", "charged", "leaking", "leaking"]
  );
});

test("全部「3 ときどき」なら、全領域 3.0・収支 0.0・とんとん", () => {
  const r = Scoring.scoreAnswers(DOMAINS, fill(3));
  r.forEach((x) => {
    assert.equal(x.score, 3);
    assert.equal(Scoring.formatBalance(x.balanceTenths), "0.0");
    assert.equal(x.status, "even");
  });
});

test("いちばん整う答え（ふつうの問いは5、（逆）は1）なら全領域 ＋2.0、その逆なら −2.0", () => {
  const best = {};
  const worst = {};
  DOMAINS.forEach((d) => {
    best[d.id] = d.questions.map((q) => (q.reverse ? 1 : 5));
    worst[d.id] = d.questions.map((q) => (q.reverse ? 5 : 1));
  });
  Scoring.scoreAnswers(DOMAINS, best).forEach((x) => {
    assert.equal(x.score, 5);
    assert.equal(x.status, "charged");
  });
  Scoring.scoreAnswers(DOMAINS, worst).forEach((x) => {
    assert.equal(x.score, 1);
    assert.equal(Scoring.formatBalance(x.balanceTenths), "−2.0");
    assert.equal(x.status, "leaking");
  });
});

test("答えがそろっていなければ採点しない", () => {
  const a = fill(3);
  a.focus = [3, 3, null, 3];
  assert.equal(Scoring.scoreAnswers(DOMAINS, a), null);
  const b = fill(3);
  b.priority = [3, 3, 3];
  assert.equal(Scoring.scoreAnswers(DOMAINS, b), null);
  assert.equal(Scoring.scoreAnswers(DOMAINS, {}), null);
  // 保存してある合計点が範囲外
  assert.equal(fromSums(sums(3, 12, 12, 12, 12)), null);
  assert.equal(fromSums(sums(21, 12, 12, 12, 12)), null);
});

test("棒の並び：漏れが大きい順（収支の小さい順）。同点は領域1→5の順", () => {
  const r = fromSums(sums(8, 16, 8, 13, 19)); // −1.0, +1.0, −1.0, +0.3, +1.8
  assert.deepEqual(
    Scoring.sortByLeak(r).map((x) => x.name),
    ["時間の主導権", "感情の消耗", "回復の習慣", "集中の質", "優先順位"]
  );
  // 元の配列は並べ替えない
  assert.deepEqual(
    r.map((x) => x.id),
    ORDER
  );
});

test("ふりかえりの領域：いちばん漏れている領域。同点は領域1→5の順で先のもの", () => {
  assert.equal(Scoring.pickWorst(fromSums(sums(12, 12, 8, 8, 12))).id, "emotion"); // 感情の消耗と回復の習慣が −1.0 で同点
  assert.equal(Scoring.pickWorst(fromSums(sums(8, 12, 12, 12, 8))).id, "time"); // 領域1と5が同点
  assert.equal(Scoring.pickWorst(fromSums(sums(16, 9, 10, 12, 4))).id, "priority"); // 同点なし
});

test("全領域が「とんとん」以上なら、いちばん収支の小さい領域（同点は領域1→5の順）", () => {
  const r = fromSums(sums(20, 13, 11, 16, 11)); // +2.0, +0.3, −0.2, +1.0, −0.2
  r.forEach((x) => assert.notEqual(x.status, "leaking"));
  assert.equal(Scoring.pickWorst(r).id, "emotion");
  const all = fromSums(sums(14, 15, 16, 17, 14)); // 全部「充電できている」
  assert.equal(Scoring.pickWorst(all).id, "time");
});

test("いちばん整っている領域：収支がいちばん大きい領域。同点は領域1→5の順で先のもの", () => {
  assert.equal(Scoring.pickBest(fromSums(sums(8, 16, 8, 16, 12))).id, "focus");
  assert.equal(Scoring.pickBest(fromSums(sums(8, 9, 10, 4, 5))).id, "emotion"); // 全部漏れていても、比べていちばん上
  assert.equal(Scoring.allSame(fromSums(sums(12, 12, 12, 12, 12))), true);
  assert.equal(Scoring.allSame(fromSums(sums(12, 12, 12, 12, 13))), false);
});

test("専門家への相談の一文：「感情の消耗」か「回復の習慣」の得点が1.5以下のときだけ", () => {
  const show = (s) => Scoring.needsSupportNote(fromSums(s));
  assert.equal(show(sums(12, 12, 6, 12, 12)), true); // 感情の消耗 1.5
  assert.equal(show(sums(12, 12, 4, 12, 12)), true); // 感情の消耗 1.0
  assert.equal(show(sums(12, 12, 7, 12, 12)), false); // 感情の消耗 1.75 → 1.8
  assert.equal(show(sums(12, 12, 12, 6, 12)), true); // 回復の習慣 1.5
  assert.equal(show(sums(12, 12, 12, 5, 12)), true); // 回復の習慣 1.25 → 1.3
  assert.equal(show(sums(12, 12, 12, 7, 12)), false); // 回復の習慣 1.75 → 1.8
  assert.equal(show(sums(4, 4, 12, 12, 4)), false); // ほかの領域が 1.0 でも出さない
  // 答えから：感情の消耗の（逆）3問に「5 いつも」、残り1問に「1」 → 1+1+1+1 = 4 → 1.0
  const a = fill(3);
  a.emotion = [5, 5, 1, 5];
  assert.equal(Scoring.needsSupportNote(Scoring.scoreAnswers(DOMAINS, a)), true);
});

test("収支の表示：＋は「+」、−は「−」（U+2212）、0は「0.0」", () => {
  assert.equal(Scoring.formatBalance(18), "+1.8");
  assert.equal(Scoring.formatBalance(5), "+0.5");
  assert.equal(Scoring.formatBalance(0), "0.0");
  assert.equal(Scoring.formatBalance(-2), "−0.2");
  assert.equal(Scoring.formatBalance(-20), "−2.0");
});
