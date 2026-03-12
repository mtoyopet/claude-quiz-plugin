# 20260312_03 クイズ解説が前の問題のものになるバグ修正

## タスク概要

2問目以降のクイズに解答したとき、解説・正解が前の問題のものになる不具合を修正する。

## 現状調査結果

### バグの原因

`QuizPanel.show(quiz)` は初回呼び出し時に `vscode.window.createWebviewPanel()` でパネルを作成し、その直後に `onDidReceiveMessage` ハンドラーを登録する（`quizPanel.ts:48-58`）。

このハンドラーは `quiz` をクロージャでキャプチャするため、**初回の `quiz` オブジェクトを永続的に参照し続ける**。

2回目以降の `show(quiz)` 呼び出しでは `panel.webview.html` のみ更新し（`quizPanel.ts:28`）、ハンドラーは再登録されない。

```
1回目: show(terraformQuiz)
  → パネル作成
  → onDidReceiveMessage 登録 (terraformQuiz をキャプチャ)

2回目: show(typescriptQuiz)
  → panel.webview.html = buildHtml(typescriptQuiz)  ← 表示は更新
  → onDidReceiveMessage はそのまま (terraformQuiz を参照)

ユーザーが TypeScript問題に解答
  → result メッセージ: answer/explanation は terraformQuiz のもの  ← バグ
```

### 関連ファイル

- `src/quizPanel.ts` — バグの発生箇所

## 実装方針

`quiz` をクラスのインスタンス変数 `private currentQuiz: Quiz | null` として保持し、`show()` でセットする。

`onDidReceiveMessage` ハンドラー内では `quiz` ではなく `this.currentQuiz` を参照することで、常に最新のクイズを使用する。

### 変更前

```typescript
show(quiz: Quiz): void {
    // ...
    this.panel.webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'answer') {
            this.isAnswered = true;
            this.panel?.webview.postMessage({
                type: 'result',
                correct: msg.index === quiz.answer,   // ← 古い quiz
                answer: quiz.answer,                  // ← 古い quiz
                explanation: quiz.explanation         // ← 古い quiz
            });
        }
    });
    // ...
}
```

### 変更後

```typescript
private currentQuiz: Quiz | null = null;

show(quiz: Quiz): void {
    this.currentQuiz = quiz;   // ← 常に最新を保持
    // ...
    this.panel.webview.onDidReceiveMessage((msg) => {
        if (msg.type === 'answer') {
            this.isAnswered = true;
            this.panel?.webview.postMessage({
                type: 'result',
                correct: msg.index === this.currentQuiz!.answer,
                answer: this.currentQuiz!.answer,
                explanation: this.currentQuiz!.explanation
            });
        }
    });
    // ...
}
```

## 修正対象ファイル

- `src/quizPanel.ts`
  - インスタンス変数 `currentQuiz` を追加
  - `show()` の先頭で `this.currentQuiz = quiz` をセット
  - `onDidReceiveMessage` ハンドラー内の `quiz.xxx` を `this.currentQuiz!.xxx` に変更

## 注意事項

- `onDidReceiveMessage` の登録はパネル初回作成時のみ行われるため、登録処理自体は変更しない
- `currentQuiz` は `panel` が破棄されたときに `null` に戻す必要はない（`isAnswered` で制御済みのため）
