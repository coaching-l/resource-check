/*
 * 人生のリソースの棚卸し（MVP）
 * ビルド不要・外部ライブラリなし・外部通信なし。回答と記入内容は localStorage にだけ保存します。
 *
 * 文言はすべて content.js、採点のきまりは scoring.js にあります。このファイルは画面の動きだけです。
 *
 * 構成（上から順に）
 *   1. 設定と文言の取り出し（CONFIG / text / fmt）
 *   2. 保存（Store）
 *   3. 日付
 *   4. 画面の部品（cacheElements / buildStaticParts）
 *   5. 画面ごとの描画（renderers / showView）
 *   6. 収支バー（renderBalanceChart / renderSummaryText）
 *   7. コピーと印刷
 *   8. 画面遷移のアクション
 *   9. イベント登録と起動（restore）
 */
(function () {
  "use strict";

  const C = CONTENT; // content.js
  const S = Scoring; // scoring.js

  // ==========================================================================
  // 1. 設定と文言
  // ==========================================================================

  // 同じ tools.coaching-l.net の他のツールと保存場所（オリジン）が共通なので、キーに名前と版を付ける
  const STORAGE_KEY = "coachingl-resource-check-v1";
  const SCHEMA_VERSION = 1;

  const CONFIG = Object.freeze({
    resumeHours: 12, // 途中で閉じたとき、この時間内に開けば続きから表示する
    maxRecords: 100, // 端末に残す過去の結果の数（超えたら古いものから消す）
    textMaxLength: 400, // 記入欄の文字数の上限
    saveDelayMs: 400, // 記入が止まってから保存するまでの時間
  });

  const VIEWS = ["start", "questions", "result", "reflect", "step", "summary"];

  /** "start.intro" のような道すじで、content.js の文言を取り出す */
  function text(path) {
    return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), C);
  }

  /** {name} を vars の値で置き換える */
  function fmt(template, vars) {
    return String(template).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));
  }

  function statusLabel(status) {
    return C.result.status[status] || status;
  }

  function domainById(id) {
    return C.domains.find((d) => d.id === id) || null;
  }

  function isObject(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v);
  }

  function newId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function clip(value) {
    return String(value || "").slice(0, CONFIG.textMaxLength);
  }

  // ==========================================================================
  // 2. 保存
  //    1つのキーに { version, current, records } を JSON で保存します。
  //    current：進行中の回（回答の途中・ふりかえりの途中）。records：過去の結果（日付つき）
  // ==========================================================================

  const Store = (function () {
    let state = blank();
    let available = true;

    function blank() {
      return { version: SCHEMA_VERSION, current: null, records: [] };
    }

    /**
     * 保存データを今の形にそろえる（形を変えるときは、ここに移行処理を足す）。
     * 知らない項目は捨てずに残す（新しい版で足した項目を、古い版で消さないように）。
     */
    function migrate(data) {
      if (!isObject(data)) return blank();
      return Object.assign({}, data, {
        version: SCHEMA_VERSION,
        current: isObject(data.current) ? data.current : null,
        records: Array.isArray(data.records) ? data.records.filter(isObject) : [],
      });
    }

    function load() {
      let raw = null;
      try {
        raw = window.localStorage.getItem(STORAGE_KEY);
      } catch (e) {
        available = false;
      }
      let data = null;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch (e) {
          data = null;
        }
      }
      state = migrate(data);
      // 読めても書けない環境（容量の上限、保存を止めたブラウザなど）があるので、小さく書いて確かめる
      try {
        window.localStorage.setItem(STORAGE_KEY + "-probe", "1");
        window.localStorage.removeItem(STORAGE_KEY + "-probe");
      } catch (e) {
        available = false;
      }
      return state;
    }

    function save() {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        available = true;
      } catch (e) {
        available = false;
      }
      return available;
    }

    return {
      load,
      get state() {
        return state;
      },
      get available() {
        return available;
      },
      setCurrent(current) {
        state.current = current ? Object.assign({}, current, { updatedAt: Date.now() }) : null;
        save();
      },
      updateCurrent(patch) {
        if (!state.current) return;
        state.current = Object.assign({}, state.current, patch, { updatedAt: Date.now() });
        save();
      },
      addRecord(record) {
        state.records.push(record);
        if (state.records.length > CONFIG.maxRecords) {
          state.records = state.records.slice(state.records.length - CONFIG.maxRecords);
        }
        save();
      },
      updateRecord(id, patch) {
        const i = state.records.findIndex((r) => r.id === id);
        if (i < 0) return;
        state.records[i] = Object.assign({}, state.records[i], patch, { updatedAt: Date.now() });
        save();
      },
      findRecord(id) {
        return state.records.find((r) => r.id === id) || null;
      },
      /** このアプリの記録だけを消す（同じオリジンの他のツールの記録には触れない） */
      clearAll() {
        state = blank();
        try {
          window.localStorage.removeItem(STORAGE_KEY);
          return true;
        } catch (e) {
          return false;
        }
      },
    };
  })();

  /** 採点できる記録だけを、古い順に返す */
  function validRecords() {
    return Store.state.records
      .filter((r) => typeof r.id === "string" && Number.isFinite(r.takenAt) && S.scoreSums(C.domains, r.sums))
      .sort((a, b) => a.takenAt - b.takenAt);
  }

  function latestRecord() {
    const list = validRecords();
    return list.length ? list[list.length - 1] : null;
  }

  /** その記録の1つ前の記録（前回）。なければ null */
  function previousRecord(record) {
    const list = validRecords();
    const i = list.findIndex((r) => r.id === record.id);
    return i > 0 ? list[i - 1] : null;
  }

  function resultsOf(record) {
    return S.scoreSums(C.domains, record.sums);
  }

  /** 記録のふりかえり欄を、問いの数にそろえて返す */
  function reflectionOf(record) {
    const r = isObject(record.reflection) ? record.reflection : {};
    const domain = domainById(r.domain) || domainById(S.pickWorst(resultsOf(record)).id);
    const n = domain.reflection.length;
    const answers = Array.isArray(r.answers) ? r.answers : [];
    const choices = Array.isArray(r.choices) ? r.choices : [];
    return {
      domain,
      answers: Array.from({ length: n }, (_, i) => (typeof answers[i] === "string" ? answers[i] : "")),
      choices: Array.from({ length: n }, (_, i) => (typeof choices[i] === "string" ? choices[i] : null)),
    };
  }

  function emptyAnswers() {
    const a = {};
    C.domains.forEach((d) => {
      a[d.id] = d.questions.map(() => null);
    });
    return a;
  }

  /** 保存してあった途中の回答を、今の質問の数にそろえる（1〜5 以外は未回答にする） */
  function normalizeAnswers(saved) {
    const a = emptyAnswers();
    if (!isObject(saved)) return a;
    C.domains.forEach((d) => {
      const list = Array.isArray(saved[d.id]) ? saved[d.id] : [];
      a[d.id] = d.questions.map((_, i) => (S.itemPoint(list[i], false) === null ? null : list[i]));
    });
    return a;
  }

  // ==========================================================================
  // 3. 日付（端末のローカル時刻）
  // ==========================================================================

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function dateKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function formatDate(key) {
    const [y, m, d] = String(key).split("-").map(Number);
    return fmt(C.common.date, { y, m, d });
  }

  function recordDate(record) {
    return formatDate(typeof record.date === "string" ? record.date : dateKey(record.takenAt));
  }

  function daysBetween(fromKey, toKey) {
    const toUtc = (k) => {
      const [y, m, d] = k.split("-").map(Number);
      return Date.UTC(y, m - 1, d);
    };
    return Math.round((toUtc(toKey) - toUtc(fromKey)) / 86400000);
  }

  // ==========================================================================
  // 4. 画面の部品
  // ==========================================================================

  const $ = (sel) => document.querySelector(sel);
  const el = {};
  let summaryParams = null; // まとめ画面で表示中の記録 { recordId, isCurrent }

  function cacheElements() {
    el.views = Array.from(document.querySelectorAll("section[data-view]"));
    el.storageNotice = $("#storage-notice");
    el.startStatus = $("#start-status");
    el.startBtn = $("#start-btn");
    el.lastBtn = $("#last-btn");
    el.lastDate = $("#last-date");
    el.qProgress = $("#q-progress");
    el.qSteps = $("#q-steps");
    el.qTitle = $("#q-title");
    el.qList = $("#q-list");
    el.qRemaining = $("#q-remaining");
    el.qNext = $("#q-next");
    el.resultChart = $("#result-chart");
    el.resultSummary = $("#result-summary");
    el.resultSupport = $("#result-support");
    el.rProgress = $("#r-progress");
    el.rSteps = $("#r-steps");
    el.rTitle = $("#r-title");
    el.rIntro = $("#r-intro");
    el.rPaper = $("#r-paper");
    el.rQuestion = $("#r-question");
    el.rChoicesBox = $("#r-choices-box");
    el.rChoices = $("#r-choices");
    el.rAnswer = $("#r-answer");
    el.stepAnswer = $("#step-answer");
    el.sTitle = $("#s-title");
    el.sDate = $("#s-date");
    el.sChart = $("#s-chart");
    el.sSummary = $("#s-summary");
    el.sSupport = $("#s-support");
    el.sReflectTitle = $("#s-reflect-title");
    el.sReflect = $("#s-reflect");
    el.sStep = $("#s-step");
    el.sSaved = $("#s-saved");
    el.sBack = $("#s-back");
    el.copyStatus = $("#copy-status");
    el.copyFallback = $("#copy-fallback");
    el.copyText = $("#copy-text");
    el.closingLinks = $("#closing-links");
    el.about = $("#about");
    el.aboutBasis = $("#about-basis");
    el.aboutReferences = $("#about-references");
    el.clearBox = $("#clear-box");
  }

  function make(tag, className, textContent) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (textContent !== undefined) node.textContent = textContent;
    return node;
  }

  /** data-text="道すじ" の要素に、content.js の文言を流し込む */
  function applyContent(root) {
    root.querySelectorAll("[data-text]").forEach((node) => {
      const v = text(node.dataset.text);
      if (typeof v === "string") node.textContent = v;
    });
  }

  /** 参考文献の *…* を斜体にして並べる（innerHTML は使わない） */
  function appendWithItalics(parent, source) {
    String(source)
      .split(/\*([^*]+)\*/)
      .forEach((part, i) => {
        if (!part) return;
        parent.appendChild(i % 2 === 1 ? make("i", "", part) : document.createTextNode(part));
      });
  }

  /**
   * 5段階の答えのラベルを、ことばの切れ目でだけ折り返すようにする
   * （「ほとんど／ない」のように。狭い画面で「ほとんどな／い」とならないように）
   */
  function appendPhrases(parent, label) {
    let parts = [label];
    try {
      if (window.Intl && Intl.Segmenter) {
        parts = Array.from(new Intl.Segmenter("ja", { granularity: "word" }).segment(label), (s) => s.segment);
      }
    } catch (e) {
      parts = [label];
    }
    parts.forEach((p, i) => {
      if (i > 0) parent.appendChild(document.createElement("wbr"));
      parent.appendChild(document.createTextNode(p));
    });
  }

  /** 文言だけで決まる部品を組み立てる（起動時に1回） */
  function buildStaticParts() {
    document.title = C.meta.docTitle;
    applyContent(document);

    el.rAnswer.maxLength = CONFIG.textMaxLength;
    el.stepAnswer.maxLength = CONFIG.textMaxLength;

    C.closing.links.forEach((link) => {
      const li = make("li");
      const a = make("a", "text-link", link.label);
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener";
      li.appendChild(a);
      el.closingLinks.appendChild(li);
    });

    C.about.basis.forEach((line) => el.aboutBasis.appendChild(make("li", "", line)));
    C.about.references.forEach((ref) => {
      const li = make("li");
      appendWithItalics(li, ref);
      el.aboutReferences.appendChild(li);
    });
  }

  function renderProgress(stepsEl, count, index) {
    stepsEl.textContent = "";
    for (let i = 0; i < count; i++) {
      const s = make("span", "progress-step" + (i < index ? " is-done" : i === index ? " is-current" : ""));
      stepsEl.appendChild(s);
    }
  }

  // ==========================================================================
  // 5. 画面ごとの描画
  // ==========================================================================

  function showView(name, params) {
    flushTexts(); // 書きかけの記入を、元の問いに保存してから画面を移る
    el.views.forEach((v) => {
      v.hidden = v.dataset.view !== name;
    });
    document.body.dataset.screen = name;
    const withExtras = name === "start" || name === "summary";
    el.about.hidden = !withExtras;
    el.clearBox.hidden = !withExtras || !(Store.state.records.length || Store.state.current);
    el.storageNotice.hidden = Store.available;
    renderers[name](params || {});
    window.scrollTo(0, 0);
    // 画面が切り替わったことを支援技術に伝えるため、見出しへフォーカスを移す
    const heading = document.querySelector('section[data-view="' + name + '"] [tabindex="-1"]');
    if (heading) {
      try {
        heading.focus({ preventScroll: true });
      } catch (e) {
        heading.focus();
      }
    }
  }

  const renderers = {
    start(params) {
      const cur = Store.state.current;
      const resuming = cur && !cur.recordId && hasAnyAnswer(cur.answers);
      el.startBtn.textContent = resuming ? C.start.resumeButton : C.start.startButton;

      const last = latestRecord();
      el.lastBtn.hidden = !last;
      el.lastDate.hidden = !last;
      if (last) {
        const days = daysBetween(last.date || dateKey(last.takenAt), dateKey(Date.now()));
        el.lastDate.textContent = fmt(C.start.lastResultDate, {
          date: recordDate(last),
          ago: days <= 0 ? C.start.agoToday : fmt(C.start.agoDays, { n: days }),
        });
      }
      el.startStatus.hidden = !params.notice;
      el.startStatus.textContent = params.notice || "";
    },

    questions() {
      const cur = Store.state.current;
      const page = cur.page;
      const domain = C.domains[page];
      el.qProgress.textContent = fmt(C.questions.progress, { n: page + 1, total: C.domains.length });
      renderProgress(el.qSteps, C.domains.length, page);
      el.qTitle.textContent = domain.name;

      el.qList.textContent = "";
      const offset = C.domains.slice(0, page).reduce((n, d) => n + d.questions.length, 0);
      domain.questions.forEach((q, i) => {
        const fs = make("fieldset", "q-card");
        const legend = make("legend", "q-text");
        legend.appendChild(make("span", "q-num", String(offset + i + 1)));
        legend.appendChild(make("span", "", q.text));
        fs.appendChild(legend);
        const scale = make("div", "scale");
        C.scale.forEach((opt) => {
          const label = make("label", "scale-option");
          const input = make("input", "visually-hidden");
          input.type = "radio";
          input.name = "q-" + domain.id + "-" + i;
          input.value = String(opt.value);
          input.dataset.domain = domain.id;
          input.dataset.index = String(i);
          input.checked = cur.answers[domain.id][i] === opt.value;
          const face = make("span", "scale-face");
          face.appendChild(make("span", "scale-num", String(opt.value)));
          const lab = make("span", "scale-text");
          appendPhrases(lab, opt.label);
          face.appendChild(lab);
          label.appendChild(input);
          label.appendChild(face);
          scale.appendChild(label);
        });
        fs.appendChild(scale);
        el.qList.appendChild(fs);
      });
      el.qNext.textContent = page < C.domains.length - 1 ? C.questions.nextButton : C.questions.lastButton;
      renderQuestionState();
    },

    result() {
      const record = Store.findRecord(Store.state.current.recordId);
      const results = resultsOf(record);
      renderBalanceChart(el.resultChart, results, previousRecord(record));
      renderSummaryText(el.resultSummary, results);
      el.resultSupport.hidden = !S.needsSupportNote(results);
    },

    reflect() {
      const cur = Store.state.current;
      const record = Store.findRecord(cur.recordId);
      const ref = reflectionOf(record);
      const domain = ref.domain;
      const total = domain.reflection.length;
      const i = Math.min(Math.max(cur.reflectIndex || 0, 0), total - 1);
      const prompt = domain.reflection[i];
      const worst = resultsOf(record).find((r) => r.id === domain.id);

      el.rProgress.textContent = fmt(C.reflect.progress, { n: i + 1, total });
      renderProgress(el.rSteps, total, i);
      el.rTitle.textContent = fmt(C.reflect.title, { name: domain.name });
      el.rIntro.hidden = i !== 0;
      el.rPaper.hidden = i !== 0;
      el.rIntro.textContent = fmt(worst.status === S.STATUS.leaking ? C.reflect.intro : C.reflect.introNotLeaking, {
        name: domain.name,
      });
      el.rQuestion.textContent = prompt.text;

      const choices = Array.isArray(prompt.choices) ? prompt.choices : [];
      el.rChoicesBox.hidden = choices.length === 0;
      el.rChoices.textContent = "";
      choices.forEach((choice) => {
        const b = make("button", "chip chip-text", choice);
        b.type = "button";
        b.dataset.action = "r-choice";
        b.dataset.choice = choice;
        b.setAttribute("aria-pressed", String(ref.choices[i] === choice));
        el.rChoices.appendChild(b);
      });
      // どの記録の何問目の欄かを、欄そのものに覚えさせる（画面を移る順番に関係なく、正しい問いに保存するため）
      el.rAnswer.dataset.recordId = record.id;
      el.rAnswer.dataset.slot = String(i);
      el.rAnswer.value = ref.answers[i];
    },

    step() {
      const record = Store.findRecord(Store.state.current.recordId);
      el.stepAnswer.dataset.recordId = record.id;
      el.stepAnswer.value = typeof record.step === "string" ? record.step : "";
    },

    summary(params) {
      const cur = Store.state.current;
      const isCurrent = params.isCurrent !== undefined ? params.isCurrent : true;
      const recordId = params.recordId || (cur && cur.recordId);
      summaryParams = { recordId, isCurrent };
      const record = Store.findRecord(recordId);
      const results = resultsOf(record);
      const ref = reflectionOf(record);

      el.sTitle.textContent = isCurrent ? C.summary.title : C.summary.titlePast;
      el.sDate.textContent = fmt(C.summary.date, { date: recordDate(record) });
      renderBalanceChart(el.sChart, results, previousRecord(record));
      renderSummaryText(el.sSummary, results);
      el.sSupport.hidden = !S.needsSupportNote(results);

      el.sReflectTitle.textContent = fmt(C.summary.reflectionTitle, { name: ref.domain.name });
      el.sReflect.textContent = "";
      ref.domain.reflection.forEach((prompt, i) => {
        el.sReflect.appendChild(make("dt", "qa-q", prompt.text));
        const dd = make("dd", "qa-a");
        if (ref.choices[i]) dd.appendChild(make("p", "qa-choice", C.summary.choicePrefix + ref.choices[i]));
        const answer = ref.answers[i].trim();
        dd.appendChild(make("p", "answer-text" + (answer ? "" : " is-empty"), answer || C.summary.empty));
        el.sReflect.appendChild(dd);
      });
      const step = typeof record.step === "string" ? record.step.trim() : "";
      el.sStep.textContent = step || C.summary.empty;
      el.sStep.classList.toggle("is-empty", !step);

      el.sSaved.hidden = !isCurrent || !Store.available;
      el.sBack.hidden = !isCurrent;
      el.copyStatus.textContent = "";
      el.copyFallback.hidden = true;
    },
  };

  function hasAnyAnswer(answers) {
    return isObject(answers) && Object.keys(answers).some((k) => Array.isArray(answers[k]) && answers[k].some((v) => v !== null));
  }

  function remainingOnPage() {
    const cur = Store.state.current;
    const domain = C.domains[cur.page];
    return cur.answers[domain.id].filter((v) => v === null).length;
  }

  /** 「次へ」を押せるかと、あと何問かの表示を更新する（選ぶたびに呼ぶ） */
  function renderQuestionState() {
    const left = remainingOnPage();
    el.qNext.disabled = left > 0;
    el.qRemaining.textContent = left > 0 ? fmt(C.questions.remaining, { n: left }) : "";
  }

  // ==========================================================================
  // 6. 収支バー（外部ライブラリなし。HTML と CSS で描く）
  //    0 を真ん中に置き、−2.0〜＋2.0 を左右に伸ばす。漏れが大きい順（収支の小さい順）に上から並べる。
  // ==========================================================================

  /** 収支（10倍の整数）を、棒の位置（左端・幅。% ）にする */
  function barGeometry(balanceTenths) {
    const halfRange = (S.RULES.max - S.RULES.mid) * 10; // 20（＝2.0）
    const width = (Math.abs(balanceTenths) / halfRange) * 50;
    return { left: balanceTenths < 0 ? 50 - width : 50, width };
  }

  function placeBar(node, balanceTenths) {
    const g = barGeometry(balanceTenths);
    // style 属性ではなく CSSOM で指定する（Content-Security-Policy の style-src 'self' のため）
    node.style.left = g.left + "%";
    node.style.width = g.width + "%";
    node.classList.add(balanceTenths < 0 ? "is-neg" : "is-pos");
  }

  function renderBalanceChart(container, results, prevRecord) {
    container.textContent = "";
    const prevResults = prevRecord ? resultsOf(prevRecord) : null;
    const prevById = {};
    if (prevResults) prevResults.forEach((r) => (prevById[r.id] = r));

    if (prevRecord) {
      const legend = make("p", "balance-legend");
      legend.appendChild(make("span", "legend-prev", ""));
      legend.lastChild.setAttribute("aria-hidden", "true");
      legend.appendChild(document.createTextNode(fmt(C.result.previousLegend, { date: recordDate(prevRecord) })));
      container.appendChild(legend);
    } else {
      container.appendChild(make("p", "balance-legend", C.result.previousNone));
    }

    const list = make("ol", "balance-list");
    S.sortByLeak(results).forEach((r) => {
      const li = make("li", "balance-row is-" + r.status);
      const head = make("div", "balance-head");
      head.appendChild(make("span", "balance-name", r.name));
      const tag = make("span", "balance-tag");
      tag.appendChild(make("span", "balance-dot"));
      tag.lastChild.setAttribute("aria-hidden", "true");
      tag.appendChild(document.createTextNode(statusLabel(r.status)));
      head.appendChild(tag);
      head.appendChild(make("span", "balance-value", S.formatBalance(r.balanceTenths)));
      li.appendChild(head);

      const track = make("div", "balance-track" + (prevResults ? " has-prev" : ""));
      track.setAttribute("aria-hidden", "true");
      track.appendChild(make("span", "balance-zero"));
      if (r.balanceTenths !== 0) {
        const bar = make("span", "balance-bar");
        placeBar(bar, r.balanceTenths);
        track.appendChild(bar);
      }
      const prev = prevById[r.id];
      if (prev && prev.balanceTenths !== 0) {
        const pb = make("span", "balance-prev");
        placeBar(pb, prev.balanceTenths);
        track.appendChild(pb);
      }
      li.appendChild(track);

      if (prev) {
        li.appendChild(
          make("p", "balance-prev-text", fmt(C.result.previousValue, { value: S.formatBalance(prev.balanceTenths) }) + "（" + statusLabel(prev.status) + "）")
        );
      }
      list.appendChild(li);
    });
    container.appendChild(list);

    const axis = make("div", "balance-axis");
    axis.setAttribute("aria-hidden", "true");
    axis.appendChild(make("span", "axis-left", "← " + C.result.axisLeft));
    axis.appendChild(make("span", "axis-zero", "0"));
    axis.appendChild(make("span", "axis-right", C.result.axisRight + " →"));
    container.appendChild(axis);
  }

  /** いちばん整っている領域・いちばん漏れている領域の文 */
  function summarySentences(results) {
    if (S.allSame(results)) return [fmt(C.result.allSame, { status: statusLabel(results[0].status) })];
    const best = S.pickBest(results);
    const worst = S.pickWorst(results);
    return [
      fmt(best.status === S.STATUS.charged ? C.result.best : C.result.bestNotCharged, { name: best.name }),
      fmt(worst.status === S.STATUS.leaking ? C.result.worst : C.result.worstNotLeaking, { name: worst.name }),
    ];
  }

  function renderSummaryText(container, results) {
    container.textContent = "";
    summarySentences(results).forEach((s) => container.appendChild(make("p", "", s)));
  }

  // ==========================================================================
  // 7. コピーと印刷
  // ==========================================================================

  function buildCopyText(record) {
    const results = resultsOf(record);
    const prev = previousRecord(record);
    const prevById = {};
    if (prev) resultsOf(prev).forEach((r) => (prevById[r.id] = r));
    const ref = reflectionOf(record);

    const lines = [fmt(C.summary.copyHeader, { date: recordDate(record) }), "", C.summary.copyBalance];
    S.sortByLeak(results).forEach((r) => {
      let line = fmt(C.summary.copyRow, { name: r.name, status: statusLabel(r.status), value: S.formatBalance(r.balanceTenths) });
      if (prevById[r.id]) line += fmt(C.summary.copyRowPrevious, { value: S.formatBalance(prevById[r.id].balanceTenths) });
      lines.push(line);
    });
    summarySentences(results).forEach((s) => lines.push(s));
    if (S.needsSupportNote(results)) lines.push(C.result.supportNote);

    lines.push("", fmt(C.summary.copyReflection, { name: ref.domain.name }));
    ref.domain.reflection.forEach((prompt, i) => {
      lines.push("Q. " + prompt.text);
      if (ref.choices[i]) lines.push(C.summary.choicePrefix + ref.choices[i]);
      lines.push("A. " + (ref.answers[i].trim() || C.summary.empty));
    });

    const step = typeof record.step === "string" ? record.step.trim() : "";
    lines.push("", C.summary.copyStep, step || C.summary.empty);
    lines.push("", C.summary.again, "", C.meta.brand);
    return lines.join("\n");
  }

  function copySummary() {
    const record = summaryParams && Store.findRecord(summaryParams.recordId);
    if (!record) return;
    const value = buildCopyText(record);
    const showFallback = () => {
      el.copyFallback.hidden = false;
      el.copyText.value = value;
      el.copyText.focus();
      el.copyText.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      el.copyStatus.textContent = ok ? C.summary.copied : C.summary.copyFallback;
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(() => {
        el.copyFallback.hidden = true;
        el.copyStatus.textContent = C.summary.copied;
      }, showFallback);
    } else {
      showFallback();
    }
  }

  function printSummary() {
    if (typeof window.print !== "function") {
      el.copyStatus.textContent = C.summary.printUnavailable;
      return;
    }
    try {
      window.print();
    } catch (e) {
      el.copyStatus.textContent = C.summary.printUnavailable;
    }
  }

  // ==========================================================================
  // 8. 画面遷移のアクション
  // ==========================================================================

  function startCheck() {
    let cur = Store.state.current;
    if (!cur || cur.recordId) {
      cur = { id: newId(), startedAt: Date.now(), page: 0, answers: emptyAnswers(), recordId: null, reflectIndex: 0 };
    }
    Store.setCurrent(Object.assign({}, cur, { view: "questions" }));
    showView("questions");
  }

  function selectAnswer(input) {
    const cur = Store.state.current;
    if (!cur || cur.recordId) return;
    const answers = normalizeAnswers(cur.answers);
    answers[input.dataset.domain][Number(input.dataset.index)] = Number(input.value);
    Store.updateCurrent({ answers });
    renderQuestionState();
  }

  function nextQuestions() {
    if (remainingOnPage() > 0) return;
    const cur = Store.state.current;
    if (cur.page < C.domains.length - 1) {
      Store.updateCurrent({ page: cur.page + 1 });
      showView("questions");
    } else {
      finishQuestions();
    }
  }

  function backQuestions() {
    const cur = Store.state.current;
    if (cur.page > 0) {
      Store.updateCurrent({ page: cur.page - 1 });
      showView("questions");
    } else {
      Store.updateCurrent({ view: "start" });
      showView("start");
    }
  }

  /** 20問に答え終えたら、結果を日付つきで保存する（ふりかえり・小さな一歩は、あとからこの記録に足す） */
  function finishQuestions() {
    const cur = Store.state.current;
    const results = S.scoreAnswers(C.domains, cur.answers);
    if (!results) return;
    const now = Date.now();
    const sums = {};
    results.forEach((r) => (sums[r.id] = r.sum));
    const worst = S.pickWorst(results);
    const n = domainById(worst.id).reflection.length;
    const record = {
      id: newId(),
      takenAt: now,
      date: dateKey(now),
      sums,
      answers: normalizeAnswers(cur.answers),
      reflection: { domain: worst.id, answers: Array(n).fill(""), choices: Array(n).fill(null) },
      step: "",
    };
    Store.addRecord(record);
    Store.updateCurrent({ recordId: record.id, view: "result", reflectIndex: 0 });
    showView("result");
  }

  function goReflect(index) {
    Store.updateCurrent({ view: "reflect", reflectIndex: index });
    showView("reflect");
  }

  function nextReflect() {
    const cur = Store.state.current;
    const ref = reflectionOf(Store.findRecord(cur.recordId));
    if (cur.reflectIndex < ref.domain.reflection.length - 1) goReflect(cur.reflectIndex + 1);
    else {
      Store.updateCurrent({ view: "step" });
      showView("step");
    }
  }

  function backReflect() {
    const cur = Store.state.current;
    if (cur.reflectIndex > 0) goReflect(cur.reflectIndex - 1);
    else {
      Store.updateCurrent({ view: "result" });
      showView("result");
    }
  }

  function toggleChoice(button) {
    flushTexts();
    const cur = Store.state.current;
    const record = Store.findRecord(cur.recordId);
    const ref = reflectionOf(record);
    const i = cur.reflectIndex;
    const choice = button.dataset.choice;
    ref.choices[i] = ref.choices[i] === choice ? null : choice;
    Store.updateRecord(record.id, { reflection: { domain: ref.domain.id, answers: ref.answers, choices: ref.choices } });
    el.rChoices.querySelectorAll("[data-choice]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.choice === ref.choices[i]));
    });
  }

  // ---- 記入欄（入力が止まって少したつと自動で保存。画面を移るときにも保存） ----

  let textTimer = null;

  function scheduleTextSave() {
    clearTimeout(textTimer);
    textTimer = setTimeout(flushTexts, CONFIG.saveDelayMs);
  }

  function flushTexts() {
    clearTimeout(textTimer);
    textTimer = null;

    // ふりかえりの欄：描いたときに覚えさせた記録・問いの番号に保存する
    const reflectRecord = el.rAnswer.dataset.recordId && Store.findRecord(el.rAnswer.dataset.recordId);
    if (reflectRecord) {
      const ref = reflectionOf(reflectRecord);
      const slot = Number(el.rAnswer.dataset.slot);
      const value = clip(el.rAnswer.value);
      if (slot >= 0 && slot < ref.answers.length && ref.answers[slot] !== value) {
        ref.answers[slot] = value;
        Store.updateRecord(reflectRecord.id, { reflection: { domain: ref.domain.id, answers: ref.answers, choices: ref.choices } });
      }
    }

    // 小さな一歩の欄
    const stepRecord = el.stepAnswer.dataset.recordId && Store.findRecord(el.stepAnswer.dataset.recordId);
    if (stepRecord) {
      const value = clip(el.stepAnswer.value);
      if (stepRecord.step !== value) Store.updateRecord(stepRecord.id, { step: value });
    }
  }

  function toSummary() {
    Store.updateCurrent({ view: "summary" });
    showView("summary", { isCurrent: true });
  }

  function openLast() {
    const last = latestRecord();
    if (last) showView("summary", { recordId: last.id, isCurrent: false });
  }

  function toStart() {
    // 今回の回を終える（結果と記入内容は記録に残っている）
    if (summaryParams && summaryParams.isCurrent) Store.setCurrent(null);
    showView("start");
  }

  function clearAll() {
    if (!window.confirm(C.start.clearConfirm)) return;
    const ok = Store.clearAll();
    showView("start", { notice: ok ? C.start.cleared : C.start.clearFailed });
  }

  // ==========================================================================
  // 9. イベント登録と起動
  // ==========================================================================

  function isValidCurrent(cur) {
    if (!isObject(cur) || VIEWS.indexOf(cur.view) < 0) return false;
    if (!Number.isInteger(cur.page) || cur.page < 0 || cur.page >= C.domains.length) return false;
    if (cur.recordId) {
      const record = Store.findRecord(cur.recordId);
      if (!record || !resultsOf(record)) return false;
      return ["result", "reflect", "step", "summary"].indexOf(cur.view) >= 0;
    }
    return cur.view === "start" || cur.view === "questions";
  }

  /** 再読み込みしたときは、途中だった画面から続ける（時間がたっていたらスタートから） */
  function restore() {
    const cur = Store.state.current;
    if (cur) {
      const fresh = Date.now() - (Number(cur.updatedAt) || 0) < CONFIG.resumeHours * 3600 * 1000;
      if (!fresh || !isValidCurrent(cur)) {
        Store.setCurrent(null);
      } else {
        const ref = cur.recordId ? reflectionOf(Store.findRecord(cur.recordId)) : null;
        const maxIndex = ref ? ref.domain.reflection.length - 1 : 0;
        Store.setCurrent(
          Object.assign({}, cur, {
            answers: normalizeAnswers(cur.answers),
            reflectIndex: Math.min(Math.max(Number(cur.reflectIndex) || 0, 0), maxIndex),
          })
        );
        if (cur.view !== "start") {
          showView(cur.view, cur.view === "summary" ? { isCurrent: true } : {});
          return;
        }
      }
    }
    showView("start");
  }

  function bindEvents() {
    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;
      switch (target.dataset.action) {
        case "start":
          startCheck();
          break;
        case "open-last":
          openLast();
          break;
        case "q-next":
          nextQuestions();
          break;
        case "q-back":
          backQuestions();
          break;
        case "to-reflect":
          goReflect(0);
          break;
        case "r-choice":
          toggleChoice(target);
          break;
        case "r-next":
          nextReflect();
          break;
        case "r-back":
          backReflect();
          break;
        case "to-summary":
          toSummary();
          break;
        case "step-back":
          goReflect(reflectionOf(Store.findRecord(Store.state.current.recordId)).domain.reflection.length - 1);
          break;
        case "summary-back":
          Store.updateCurrent({ view: "step" });
          showView("step");
          break;
        case "copy":
          copySummary();
          break;
        case "print":
          printSummary();
          break;
        case "to-start":
          toStart();
          break;
        case "clear":
          clearAll();
          break;
      }
    });

    el.qList.addEventListener("change", (e) => {
      if (e.target.matches('input[type="radio"]')) selectAnswer(e.target);
    });
    el.rAnswer.addEventListener("input", scheduleTextSave);
    el.stepAnswer.addEventListener("input", scheduleTextSave);

    // 画面を閉じる・別のアプリに切り替えるときは、書きかけの内容をすぐ保存する
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushTexts();
    });
    window.addEventListener("pagehide", flushTexts);
  }

  function init() {
    cacheElements();
    buildStaticParts();
    Store.load();
    bindEvents();
    restore();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
