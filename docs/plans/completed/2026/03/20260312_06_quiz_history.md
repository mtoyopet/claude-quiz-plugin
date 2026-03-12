# 20260312_06 クイズ履歴機能の追加

## タスク概要

問題・回答・正誤を記録して一覧表示する履歴機能を追加する。

## 現状調査

### データフロー

1. `StateWatcher` がClaude Codeのツール使用を検知
2. `generateQuiz()` でClaudeにクイズを生成させる
3. `QuizPanel.show(quiz)` でWebViewに表示
4. ユーザーが選択肢をクリック → `webview.onDidReceiveMessage` で `msg.type === 'answer'` を受信
5. 正誤判定して `result` メッセージをWebViewに返す

### 現在の正誤判定箇所（[quizPanel.ts:52-59](src/quizPanel.ts#L52-L59)）

```ts
if (msg.type === 'answer') {
    this.isAnswered = true;
    this.panel?.webview.postMessage({
        type: 'result',
        correct: msg.index === this.currentQuiz!.answer,
        answer: this.currentQuiz!.answer,
        explanation: this.currentQuiz!.explanation
    });
}
```

### 永続化の仕組み

VSCode拡張では `vscode.ExtensionContext.globalState` を使うとワークスペースをまたいで永続化できる。

## 実装方針

### 1. データ構造

```ts
interface QuizRecord {
    id: string;           // タイムスタンプベースのID
    timestamp: string;    // ISO形式
    topic: string;        // トピック
    question: string;     // 問題文
    choices: string[];    // 選択肢
    correctAnswer: number; // 正解インデックス
    userAnswer: number;   // ユーザーの回答インデックス
    isCorrect: boolean;   // 正誤
    explanation: string;  // 解説
}
```

### 2. 新規ファイル

- `src/quizHistory.ts` — `QuizHistory` クラス（globalStateを使った記録・取得）

### 3. 修正ファイル

- `src/quizPanel.ts` — 回答時に `QuizHistory.add()` を呼ぶ。コンストラクタで `ExtensionContext` を受け取るよう変更
- `src/extension.ts` — `QuizPanel` に `context` を渡す。履歴表示コマンド `claudeQuiz.showHistory` を登録
- `package.json` — コマンド `claudeQuiz.showHistory` を追加

### 4. 履歴の表示方法

新しい `HistoryPanel` クラスを作成してWebViewで表示。
- `claudeQuiz.showHistory` コマンドで開く
- 一覧は新しい → 古い順
- 各行に「問題（折り畳み可）」「正誤マーク ✓/✗」「トピック」「日時」を表示
- 正解率のサマリーをヘッダーに表示

### 5. UIの表示内容（履歴パネル）

```
正解率: 7/10 (70%)

[✓] 2026-03-12 14:30  TypeScript
    問: interfaceとtypeの違いは？
    答: interface は宣言マージが可能 ← あなたの回答

[✗] 2026-03-12 14:25  React
    問: useEffectの第2引数の役割は？
    答: レンダリング時に毎回実行する（誤）
    正解: 依存配列の値が変わった時のみ実行する
```

## 修正対象ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `src/quizHistory.ts` | 新規作成: `QuizHistory` クラス |
| `src/historyPanel.ts` | 新規作成: `HistoryPanel` クラス |
| `src/quizPanel.ts` | コンストラクタで `QuizHistory` を受け取り、回答時に記録 |
| `src/extension.ts` | `QuizHistory` インスタンスを生成・渡す。`showHistory` コマンド登録 |
| `package.json` | `claudeQuiz.showHistory` コマンド追加 |

## 注意事項

- `globalState` はVSCode拡張の再起動をまたいで永続化される
- 履歴件数が増えすぎないよう、上限（例: 200件）を設けて古いものを削除
- `QuizPanel` のコンストラクタ変更は既存の呼び出し側（`extension.ts`）に影響するため合わせて修正
