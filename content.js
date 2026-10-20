/*
 * 人生のリソースの棚卸し — 文言のすべて
 *
 * 質問・ふりかえりの問い・画面の文言は、このファイルだけにまとめています。
 * 文言を直すときは、" " の中の文字だけを書き換えてください。
 *
 * 書き換えるときの約束
 *   - " "（半角のダブルクォーテーション）と、行の終わりの ,（カンマ）は消さないでください。
 *   - {name} や {date} のような { } の部分は、アプリが名前や日付に置き換えます。そのまま残してください。
 *   - id: "..." は、保存した記録と結びつけるための名前です。変えないでください。
 *   - 質問の並び順を入れ替えると、前回までの回答とずれます。並び順は変えずに、文だけを直してください。
 *   - reverse: true は、逆転して採点する質問（SPEC.md の「（逆）」）です。
 *     （逆）の印は画面には出しません。採点のしかたは scoring.js にあります。
 *   - 参考文献の *…* で囲んだ部分は、画面では斜体で表示します。
 *
 * 直したあとは、index.html の content.js?v=1 の数字を1つ上げてください（README の「公開」を参照）。
 */
const CONTENT = {
  // ---- アプリの名前など ----
  meta: {
    title: "人生のリソースの棚卸し",
    subtitle: "時間・エネルギー・感情の現在地を知る5分のセルフチェック",
    provider: "提供：COACHING-L（コーチ：刈谷洋介）",
    brand: "COACHING-L",
    docTitle: "人生のリソースの棚卸し | COACHING-L", // ブラウザのタブに出る名前
  },

  // ---- 共通 ----
  common: {
    back: "戻る",
    next: "次へ",
    privacy: "記録はこの端末の中だけに保存され、外部には送信されません",
    storageUnavailable: "この環境では記録を保存できません（セルフチェックは使えます）。",
    // 日付の書き方（年・月・日の数字が入ります）
    date: "{y}年{m}月{d}日",
  },

  // ---- 0. スタート ----
  start: {
    duration: "所要時間：約5分＋ふりかえり5分",
    intro:
      "時間やエネルギーは、限りある大切な資源です。このセルフチェックでは、今の自分がその資源をどう使っているかを棚卸しし、どこで充電できていて、どこで漏れているかを確かめます。正解はありません。この1か月ほどの自分を思い浮かべて、感じたままに答えてください。",
    notDiagnosis: "これは診断ではなく、今の自分をふりかえるためのセルフチェックです。",
    startButton: "はじめる",
    resumeButton: "続きからはじめる", // 質問の途中で「戻る」を押してスタートに戻ったとき
    lastResultButton: "前回の結果を見る",
    lastResultDate: "前回：{date}（{ago}）",
    agoToday: "今日",
    agoDays: "{n}日前",
    clearButton: "記録を消す",
    clearConfirm:
      "この端末に保存した回答・記入内容・過去の結果・お名前を、すべて消します。元には戻せません。よろしいですか？",
    cleared: "記録を消しました。",
    clearFailed: "記録を消せませんでした。ブラウザの設定で、このサイトのデータを削除してください。",
  },

  // ---- 1. 質問 ----
  // 5段階の答え（左から順に 1〜5）
  scale: [
    { value: 1, label: "ほとんどない" },
    { value: 2, label: "あまりない" },
    { value: 3, label: "ときどきある" },
    { value: 4, label: "よくある" },
    { value: 5, label: "いつも" },
  ],

  questions: {
    progress: "{n} / {total}",
    lead: "この1か月ほどの自分を思い浮かべて、いちばん近いものを選んでください。",
    remaining: "あと{n}問答えると、次へ進めます",
    nextButton: "次へ",
    lastButton: "結果を見る", // 最後（5画面目）の「次へ」
  },

  // 5つの領域。並び順が「領域1→5」の順番です（同点のときは、この順で先に来るものを選びます）
  domains: [
    {
      id: "time",
      name: "時間の主導権",
      questions: [
        { text: "1日の時間の使い方を、自分で選んでいると感じる" },
        { text: "予定の多くは、自分の意思で決めたものだ" },
        { text: "頼まれごとに流されているうちに、1日が終わる", reverse: true },
        { text: "「やらされている」と感じながら過ごす時間がある", reverse: true },
      ],
      reflection: [
        { text: "この1週間で、「自分で選んだ」と感じられた時間はどこでしたか？" },
        { text: "流されて使った時間のうち、1つだけ取り戻すとしたら、どれですか？" },
        { text: "取り戻したその時間を、何に使いたいですか？" },
      ],
    },
    {
      id: "focus",
      name: "集中の質",
      questions: [
        { text: "時間を忘れて取り組める時間がある" },
        { text: "大事な仕事のために、まとまった時間を確保できている" },
        { text: "通知やメッセージで、取り組んでいることが途切れる", reverse: true },
        { text: "取り組んでいることに、難しすぎず簡単すぎない、ちょうどいい手応えがある" },
      ],
      reflection: [
        { text: "最近、時間を忘れて取り組めたのは、どんなときでしたか？" },
        { text: "今、あなたの集中を途切れさせているものは何ですか？" },
        { text: "今週、30分だけ守るとしたら、いつ、どこで、何に取り組みますか？" },
      ],
    },
    {
      id: "emotion",
      name: "感情の消耗",
      questions: [
        { text: "職場の人の言動が、頭から離れなくなる", reverse: true },
        { text: "終わったことを、何度も考え直してしまう", reverse: true },
        { text: "気持ちがざわついたとき、立て直す自分なりの方法がある" },
        { text: "感情的に反応して、あとで後悔する言動をとる", reverse: true },
      ],
      reflection: [
        {
          text: "最近、気持ちを引きずった場面を1つ思い浮かべてください。それに、どのくらいの時間とエネルギーを使いましたか？",
        },
        { text: "次に似た場面が来たら、気持ちを立て直すためにできそうなことは何ですか？" },
        { text: "それを今週、一度だけ試すとしたら、いつにしますか？" },
      ],
    },
    {
      id: "recovery",
      name: "回復の習慣",
      questions: [
        { text: "仕事が終わったら、仕事のことを考えずに過ごせる" },
        { text: "心と体がゆるむ時間を、意識してとっている" },
        { text: "仕事とは別に、新しいことに挑戦したり学んだりする時間がある" },
        { text: "休みの時間に何をするかを、自分で決められている" },
      ],
      reflection: [
        { text: "最近、心からほっとできたのは、どんなときでしたか？" },
        {
          text: "今のあなたに足りない回復は、次のどれだと感じますか？",
          // 選択肢（タップで1つ選べます。もう一度押すと外れます。選ばなくても進めます）
          choices: ["仕事から離れる", "心と体をゆるめる", "新しいことに挑戦する", "自分で決める"],
        },
        { text: "今週、回復のための時間を1つ予定に入れるとしたら、何を入れますか？" },
      ],
    },
    {
      id: "priority",
      name: "優先順位",
      questions: [
        { text: "緊急ではないけれど大切なことに、時間を使えている" },
        { text: "本当に大切なことを確かめる時間を、定期的にとっている" },
        { text: "急ぎの用事に追われて、大切なことが後回しになる", reverse: true },
        { text: "時間をかけたことをふりかえると、「意味があった」と思える" },
      ],
      reflection: [
        { text: "今のあなたにとって、緊急ではないけれど大切なことは何ですか？" },
        { text: "それが後回しになっているのは、何に時間を取られているからですか？" },
        { text: "今週、そのために15分だけ予約するとしたら、いつにしますか？" },
      ],
    },
  ],

  // ---- 3. 結果 ----
  result: {
    title: "あなたのエネルギーの収支",
    howToRead: "棒が右に伸びるほど充電できていて、左に伸びるほど漏れています。真ん中の線（0）が「とんとん」です。",
    axisLeft: "漏れている",
    axisRight: "充電できている",
    // 収支のラベル（棒の横に出します）
    status: {
      charged: "充電できている",
      even: "とんとん",
      leaking: "漏れている",
    },
    // 前回の結果があるときだけ出します
    previousLegend: "細い金色の棒：前回（{date}）",
    previousValue: "前回 {value}",
    previousNone: "前回の記録はありません。次回から、前回との違いを重ねて表示します。",
    // いちばん整っている領域・いちばん漏れている領域の文
    best: "いちばん整っているのは「{name}」です。",
    bestNotCharged: "比べると、いちばん整っているのは「{name}」です。", // 「充電できている」領域がないとき
    worst: "いちばん漏れているのは「{name}」です。",
    worstNotLeaking: "漏れている領域はありませんでした。いちばん収支が小さいのは「{name}」です。", // 「漏れている」領域がないとき
    allSame: "5つの領域の収支は、すべて同じ（{status}）でした。", // 5つとも同じ収支のとき
    disclaimer:
      "これは診断ではなく、今の自分の感じ方を映したものです。他の人と比べるものではありません。同じ状態が続くか、変わっていくかを、ときどき確かめてみてください。",
    // 「感情の消耗」または「回復の習慣」の得点が1.5以下のときだけ出します（条件は scoring.js）
    supportNote: "つらさが続くときは、ひとりで抱えずに、医師やカウンセラーなどの専門家に相談してください。",
    toReflection: "ふりかえりに進む",
  },

  // ---- 4. ふりかえり ----
  reflect: {
    title: "ふりかえり：{name}",
    progress: "問い {n} / {total}",
    intro: "いちばん漏れている「{name}」について、3つの問いを用意しました。",
    introNotLeaking: "いちばん収支が小さい「{name}」について、3つの問いを用意しました。",
    paperGuide:
      "よければ、紙とペンを用意してください。手で書くと、深まります。もちろん、下の欄に書いても大丈夫です。",
    answerLabel: "記入欄（任意）",
    choicesLabel: "近いものを1つ選べます（任意）",
    optionalHint: "空欄のままでも進めます。書いた内容は、この端末の中に自動で保存されます。",
  },

  // ---- 5. 小さな一歩 ----
  step: {
    title: "小さな一歩",
    question: "この1週間で試してみる、小さな一歩を1つ決めるとしたら？",
    hint: "空欄のままでも進めます。書いた内容は、この端末の中に自動で保存されます。",
    toSummary: "まとめを見る",
  },

  // ---- 5'. まとめ ----
  summary: {
    title: "今回のまとめ",
    titlePast: "前回の結果",
    date: "{date}に記録",
    reflectionTitle: "ふりかえり：{name}",
    stepTitle: "小さな一歩",
    empty: "（記入なし）",
    choicePrefix: "選んだもの：",
    saved: "この結果は、日付つきでこの端末の中に保存しました。次回、前回との比較に使います。",
    // お名前（任意）。印刷とコピーに入ります
    nameLabel: "お名前（任意）",
    namePlaceholder: "例：山田 花子",
    nameHint:
      "コーチングセッションで使う方は、お名前を入れてから印刷（PDFで保存）またはコピーをして、コーチに共有すると便利です。お名前は、この端末の中だけに保存されます。",
    nameLine: "お名前：{name}", // 印刷とコピーに入る行
    // 印刷するときのページの名前（「PDFに保存」のファイル名になることが多い）。{date} は 20261020 の形
    printTitle: "人生のリソースの棚卸し_{date}",
    printTitleWithName: "人生のリソースの棚卸し_{name}_{date}",
    copyButton: "テキストでコピー",
    copied: "コピーしました。LINE やメモに貼り付けられます。",
    copyFallback: "自動でコピーできませんでした。下の文章を長押し（または選択）して、コピーしてください。",
    printButton: "印刷する（PDFで保存）",
    printHint: "印刷の画面で「PDFに保存」を選ぶと、PDFとして残せます。",
    printUnavailable: "この画面からは印刷できません。Safari や Chrome などのブラウザで開き直すか、「テキストでコピー」をお使いください。",
    again: "1か月後に、もう一度やってみてください。変化が見えてきます。",
    backToStart: "はじめに戻る",
    backToStep: "小さな一歩に戻る",
    // コピーする文章の見出し
    copyHeader: "人生のリソースの棚卸し（{date}）",
    copyBalance: "■ あなたのエネルギーの収支",
    copyRow: "{name}：{status}（{value}）",
    copyRowPrevious: "　前回 {value}",
    copyReflection: "■ ふりかえり：{name}",
    copyStep: "■ 小さな一歩",
  },

  // ---- 6. 結びの案内 ----
  closing: {
    title: "この漏れを、コーチと一緒に整えたい方へ",
    body:
      "ひとりで棚卸しをして、ここまで見つめられたこと自体に意味があります。もし、もっと深いところまで整えていきたいと感じたら、統合型パーソナルコーチングとは何かを改めてご覧ください。",
    links: [
      { label: "統合型パーソナルコーチングの概要", url: "https://coaching-l.net/integrated-personal-coaching/" },
      { label: "個別無料説明会", url: "https://coaching-l.net/briefing-session/" },
    ],
  },

  // ---- 7. このセルフチェックの背景 ----
  about: {
    title: "このセルフチェックの背景",
    body:
      "このセルフチェックは、心理学や時間管理の代表的な考え方を参考に、COACHING-Lが作成したものです。科学的に検証された心理検査ではありません。質問はすべてオリジナルです。",
    overallLabel: "全体の考え方",
    overall:
      "資源保存理論（人は大切な資源を守り、増やそうとし、資源が失われたり回復しなかったりするとストレスが生じる）",
    basisLabel: "各領域の参考",
    basis: [
      "時間の主導権＝自己決定理論の自律性",
      "集中の質＝フロー理論",
      "感情の消耗＝感情調整のプロセスモデル",
      "回復の習慣＝リカバリー経験",
      "優先順位＝時間管理のマトリクス（第2領域）",
    ],
    referencesLabel: "参考文献",
    // SPEC.md の表記のまま（*…* は斜体）。tests/content.test.js で SPEC.md と一字一句同じかを確かめています
    references: [
      "Covey, S. R. (1989). *The seven habits of highly effective people: Restoring the character ethic.* Simon and Schuster.",
      "Csikszentmihalyi, M. (1990). *Flow: The psychology of optimal experience.* Harper and Row.",
      "Gross, J. J. (1998). The emerging field of emotion regulation: An integrative review. *Review of General Psychology, 2*, 271–299.",
      "Hobfoll, S. E. (1989). Conservation of resources: A new attempt at conceptualizing stress. *American Psychologist, 44*(3), 513–524.",
      "Ryan, R. M., & Deci, E. L. (2000). Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. *American Psychologist, 55*, 68–78.",
      "Sonnentag, S., & Fritz, C. (2007). The Recovery Experience Questionnaire: Development and validation of a measure for assessing recuperation and unwinding from work. *Journal of Occupational Health Psychology, 12*(3), 204–221.",
    ],
  },
};

// テスト（tests/）から読み込むための1行です。ブラウザでは使いません
if (typeof module !== "undefined" && module.exports) module.exports = CONTENT;
