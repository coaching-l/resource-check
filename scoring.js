/*
 * 人生のリソースの棚卸し — 採点
 *
 * SPEC.md の「2. 採点」をそのまま書いたものです。画面のことは何もしません
 * （tests/scoring.test.js から、ブラウザなしで確かめられるようにするため）。
 *
 *   各問の点     ＝ 答え（1〜5）。（逆）の問いは 1→5、2→4、3→3、4→2、5→1 に逆転する
 *   領域の得点   ＝ 4問の平均（1.0〜5.0、小数第1位まで。四捨五入）
 *   収支         ＝ 得点 − 3.0（−2.0〜＋2.0）
 *   ＋0.5以上    ：充電できている（charged）
 *   −0.5以下     ：漏れている（leaking）
 *   その間       ：とんとん（even）
 *
 * 小数の誤差を避けるため、得点と収支は「10倍した整数」（例：3.3 → 33）で計算しています。
 * 4問の平均は 0.25 刻みなので、四捨五入しても区分（充電／とんとん／漏れ）は変わりません。
 */
const Scoring = (function () {
  "use strict";

  const RULES = Object.freeze({
    min: 1,
    max: 5,
    mid: 3, // 収支の基準（得点 − 3.0）
    chargedFrom: 0.5, // 収支がこれ以上なら「充電できている」
    leakingTo: -0.5, // 収支がこれ以下なら「漏れている」
    // 専門家への相談を添える条件：この領域のどれかの得点が supportScoreMax 以下
    supportDomains: Object.freeze(["emotion", "recovery"]),
    supportScoreMax: 1.5,
  });

  const STATUS = Object.freeze({ charged: "charged", even: "even", leaking: "leaking" });

  /** 1問の点。（逆）の問いは逆転する */
  function itemPoint(value, reverse) {
    if (!Number.isInteger(value) || value < RULES.min || value > RULES.max) return null;
    return reverse ? RULES.min + RULES.max - value : value;
  }

  /** 1つの領域の合計点（4〜20）。答えがそろっていなければ null */
  function domainSum(domain, values) {
    if (!Array.isArray(values) || values.length !== domain.questions.length) return null;
    let sum = 0;
    for (let i = 0; i < domain.questions.length; i++) {
      const p = itemPoint(values[i], Boolean(domain.questions[i].reverse));
      if (p === null) return null;
      sum += p;
    }
    return sum;
  }

  /** 合計点から、得点・収支・区分を出す */
  function fromSum(domain, sum, index) {
    const count = domain.questions.length;
    // 得点（平均）を10倍して四捨五入：例 13 / 4 = 3.25 → 33
    const scoreTenths = Math.round((sum * 10) / count);
    const balanceTenths = scoreTenths - RULES.mid * 10;
    let status = STATUS.even;
    if (balanceTenths >= Math.round(RULES.chargedFrom * 10)) status = STATUS.charged;
    else if (balanceTenths <= Math.round(RULES.leakingTo * 10)) status = STATUS.leaking;
    return {
      id: domain.id,
      name: domain.name,
      index, // 領域1→5の順番（0〜4）。同点のときに使う
      sum,
      scoreTenths,
      balanceTenths,
      score: scoreTenths / 10,
      balance: balanceTenths / 10,
      status,
    };
  }

  /**
   * 回答（{ 領域id: [1〜5, …] }）から、5領域の結果を領域1→5の順で返す。
   * どこかの答えが足りなければ null
   */
  function scoreAnswers(domains, answers) {
    const sums = {};
    for (const d of domains) {
      const s = domainSum(d, answers && answers[d.id]);
      if (s === null) return null;
      sums[d.id] = s;
    }
    return scoreSums(domains, sums);
  }

  /** 保存してある合計点（{ 領域id: 4〜20 }）から結果を出す。足りなければ null */
  function scoreSums(domains, sums) {
    const results = [];
    for (let i = 0; i < domains.length; i++) {
      const d = domains[i];
      const s = sums ? sums[d.id] : undefined;
      const n = d.questions.length;
      if (!Number.isInteger(s) || s < RULES.min * n || s > RULES.max * n) return null;
      results.push(fromSum(d, s, i));
    }
    return results;
  }

  /** 収支の小さい順（漏れが大きい順）。同点は領域1→5の順 */
  function sortByLeak(results) {
    return results.slice().sort((a, b) => a.balanceTenths - b.balanceTenths || a.index - b.index);
  }

  /** いちばん漏れている（収支がいちばん小さい）領域。同点は領域1→5の順で先のもの */
  function pickWorst(results) {
    return sortByLeak(results)[0];
  }

  /** いちばん整っている（収支がいちばん大きい）領域。同点は領域1→5の順で先のもの */
  function pickBest(results) {
    return results.slice().sort((a, b) => b.balanceTenths - a.balanceTenths || a.index - b.index)[0];
  }

  /** 5つとも同じ収支か */
  function allSame(results) {
    return results.every((r) => r.balanceTenths === results[0].balanceTenths);
  }

  /** 専門家への相談の一文を添えるか */
  function needsSupportNote(results) {
    const max = Math.round(RULES.supportScoreMax * 10);
    return results.some((r) => RULES.supportDomains.indexOf(r.id) >= 0 && r.scoreTenths <= max);
  }

  /** 収支の表示：+0.8 / −1.3（全角ではないマイナス記号 U+2212）/ 0.0 */
  function formatBalance(balanceTenths) {
    const abs = Math.abs(balanceTenths);
    const text = Math.floor(abs / 10) + "." + (abs % 10);
    if (balanceTenths > 0) return "+" + text;
    if (balanceTenths < 0) return "−" + text;
    return text;
  }

  return {
    RULES,
    STATUS,
    itemPoint,
    domainSum,
    scoreAnswers,
    scoreSums,
    sortByLeak,
    pickWorst,
    pickBest,
    allSame,
    needsSupportNote,
    formatBalance,
  };
})();

// テスト（tests/）から読み込むための1行です。ブラウザでは使いません
if (typeof module !== "undefined" && module.exports) module.exports = Scoring;
