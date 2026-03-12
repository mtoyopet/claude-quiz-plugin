# 20260312_09 不正解時に正解ボタンをハイライト

## タスク概要

不正解だったとき、正解の選択肢ボタンを目立つ色でハイライトして、どれが正解か一目で分かるようにする。

## 現状調査結果

### 関連ファイル

- `media/quiz.js` — `result` メッセージ受信時に `msg.answer`（正解インデックス）が取得できる
- `media/quiz.css` — ボタンのスタイル定義

### 現在のフロー

`result` メッセージ受信時:
- `msg.correct`: 正解/不正解
- `msg.answer`: 正解のインデックス（0〜3）

ボタンは `data-index` 属性を持っているので、`querySelector('[data-index="N"]')` で正解ボタンを特定できる。

## 実装方針

### JS の変更

不正解時のみ、正解ボタンに `correct-answer` クラスを付与する。

```js
if (!msg.correct) {
    const correctBtn = document.querySelector(`#choices button[data-index="${msg.answer}"]`);
    correctBtn?.classList.add('correct-answer');
}
```

### CSS の変更

`.correct-answer` クラスのスタイルを追加。緑系（`--vscode-testing-iconPassed`）でハイライト。

```css
#choices button.correct-answer {
    background: var(--vscode-testing-iconPassed, #2d7a2d);
    color: white;
    border-color: var(--vscode-testing-iconPassed, #2d7a2d);
    opacity: 1;
}
```

## 修正対象ファイル

| ファイル | 変更内容 |
|---|---|
| `media/quiz.js` | 不正解時に正解ボタンへ `correct-answer` クラスを付与 |
| `media/quiz.css` | `.correct-answer` スタイルを追加（緑系） |

## 注意事項

- 正解時は不要（自分がクリックしたボタン＝正解なので `.selected` の青ハイライトで十分）
- `opacity: 1` を明示して、`button:disabled` の `opacity: 0.6` を上書きする
