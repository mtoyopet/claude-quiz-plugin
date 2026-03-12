# 20260312_08 選択した回答ボタンのハイライト

## タスク概要

回答後に、ユーザーがクリックした選択肢のボタン色を変えて、どれを選んだか分かるようにする。

## 現状調査結果

### 関連ファイル

- `media/quiz.js` — クリック時に `postMessage` → `result` メッセージ受信後に結果表示
- `media/quiz.css` — ボタンのスタイル定義

### 現在のフロー

1. ボタンクリック → 全ボタン `disabled` → `answer` メッセージ送信
2. バックエンドから `result` メッセージ受信 → 正解/不正解テキスト表示

クリックしたボタンが `disabled` になるだけで、色の変化なし。

## 実装方針

### JS の変更

クリック時に選択したボタンに `selected` クラスを付与する。

```js
btn.classList.add('selected');
```

### CSS の変更

`.selected` クラスのスタイルを追加。正解・不正解は結果受信後に分かるので、選択時はニュートラルな「選択済み」色（アクセントカラー）にする。

```css
#choices button.selected {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
}
```

VSCode のプライマリボタン色（青系）を使うことで、テーマに関わらず視認性が高い。

## 修正対象ファイル

| ファイル | 変更内容 |
|---|---|
| `media/quiz.js` | クリック時に選択ボタンへ `selected` クラスを追加 |
| `media/quiz.css` | `.selected` スタイルを追加 |

## 注意事項

- 正解・不正解の色（`#result.correct` / `#result.incorrect`）とは別のスタイルで、ボタン自体の色を変える
- `disabled` 後も `selected` クラスは維持されるので、回答後も選択肢が分かる
