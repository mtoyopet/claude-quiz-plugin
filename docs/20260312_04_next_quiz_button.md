# 20260312_04 次の問題を生成するボタンの追加

## タスク概要

回答後に「次の問題を表示する」ボタンを表示し、押下時に同じトピックで新しいクイズを生成して表示する。

## 現状調査結果

### 現在のフロー

1. `StateWatcher` → `sessionContext.addEvent()` → debounce → `generateQuiz(topic)` → `quizPanel.show(quiz)`
2. ユーザーが選択肢をクリック → `quiz.js` が `postMessage({type: 'answer'})` → `quizPanel.ts` が正解判定して `postMessage({type: 'result'})` を返す
3. `quiz.js` が結果（正解/不正解）と解説を表示して終了

### 関連ファイル

- `media/quiz.js`: Webview側UI。結果表示後に何もしない
- `src/quizPanel.ts`: メッセージハンドラ。`answer` メッセージのみ処理
- `src/extension.ts`: クイズ生成の呼び出し元。`generateQuiz(topic)` を実行

## 実装方針

### 1. `media/quiz.js` に「次の問題を表示する」ボタンを追加

結果表示後に `<button id="next-btn">次の問題を表示する</button>` を追加し、クリック時に `postMessage({type: 'nextQuiz'})` を送信する。

### 2. `src/quizPanel.ts` に `onNextQuiz` コールバックを追加

- コンストラクタで `onNextQuiz: () => void` コールバックを受け取る（または後からセットできるプロパティにする）
- `webview.onDidReceiveMessage` で `msg.type === 'nextQuiz'` を処理し、コールバックを呼ぶ
- `isAnswered` は `true` のままにして問題なし（新しいクイズ生成後に `show()` で `false` にリセットされる）

### 3. `src/extension.ts` でコールバックを設定

`quizPanel` に `onNextQuiz` コールバックとして「現在の `topic` で `generateQuiz()` → `quizPanel.show()` する」ロジックを渡す。

ただし `topic` はコールバック実行時点の `sessionContext.inferTopic()` を使う（クロージャで参照）。

## 修正対象ファイル

| ファイル | 変更内容 |
|---|---|
| `media/quiz.js` | 結果表示後に「次の問題を表示する」ボタンを追加、`nextQuiz` メッセージ送信 |
| `src/quizPanel.ts` | `onNextQuiz` コールバックプロパティ追加、メッセージハンドラに `nextQuiz` ケース追加 |
| `src/extension.ts` | `quizPanel.onNextQuiz` にクイズ再生成ロジックを設定 |

## 注意事項

- ボタン押下中（API呼び出し中）は二重送信を防ぐためボタンを disabled にする
- エラー時は `vscode.window.showWarningMessage` で通知（既存パターンに合わせる）
- `quiz.js` 側でローディング表示を簡易的に入れる（「生成中...」テキスト）
