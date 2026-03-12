# 20260312_07 問題パネルUIの改善

## タスク概要

問題パネルの見た目を改善する。

- 問題を枠で囲む
- 回答項目を目立たせる
- 問題項目に A〜D ラベルをつける（例: `A: XXXXX`）

## 現状調査結果

### 関連ファイル

- `media/quiz.js` — パネルの HTML を動的に生成
- `media/quiz.css` — スタイル定義

### 現在の構造（quiz.js）

```html
<div id="topic">...</div>
<div id="question">...</div>
<ul id="choices">
  <li><button data-index="0">選択肢1</button></li>
  ...
</ul>
<div id="result"></div>
```

- 選択肢ボタンはラベルなし（テキストのみ）
- 問題文は背景・枠なし

## 実装方針

### 1. 問題を枠で囲む（CSS）

`#question` に `border`, `border-radius`, `padding`, `background` を追加してカード風に。

### 2. 回答項目を目立たせる（CSS）

- ボタンの左側にラベル（A/B/C/D）を **太字** で表示するため、ボタン内を flex レイアウトにし、ラベル部分に左パディングを加える
- ボタン全体の padding・font-size を少し大きくする

### 3. A〜D ラベルを付ける（JS）

`quiz.js` の選択肢生成部分を変更:

```js
const labels = ['A', 'B', 'C', 'D'];
quiz.choices.map((c, i) => `
  <li><button data-index="${i}">
    <span class="choice-label">${labels[i]}:</span>
    <span class="choice-text">${c}</span>
  </button></li>
`)
```

## 修正対象ファイル

| ファイル | 変更内容 |
|---|---|
| `media/quiz.js` | 選択肢ボタンに A〜D ラベルのスパンを追加 |
| `media/quiz.css` | 問題枠のスタイル、ボタン内 flex レイアウト、ラベルスタイルを追加 |

## 注意事項

- 選択肢が 5 個以上になった場合、E 以降のラベルが必要になるが、現状のクイズ生成は 4 択固定なので対応不要
- 不正解時の「正解は〜」表示は `quiz.choices[msg.answer]` のテキストを使用しているが、ここにも `A: ` のプレフィックスを付けると親切
