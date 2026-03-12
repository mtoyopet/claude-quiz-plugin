# 20260312_12 「次の問題を表示する」ボタンが消える不具合の修正

## タスク概要

回答後に表示される「次の問題を表示する」ボタンが、StateWatcher による新しいクイズ生成のタイミングによって消えてしまう不具合を修正する。

## 現状調査結果

### バグの再現フロー

1. ユーザーが回答 → `isAnswered = true` → `result` メッセージ送信 → ボタン表示
2. `StateWatcher` が発火（ユーザーがコーディング継続中）→ debounce 後に `generateQuiz()` 実行
3. `show()` が呼ばれる → `this.panel` あり・`this.isAnswered === true` → 早期リターンしない
4. `this.panel.webview.html = this.buildHtml(quiz)` でパネルの HTML が上書きされる
5. **ボタンが消える**（新しいクイズの初期 HTML に切り替わるため）

### 根本原因

`quizPanel.ts` の `show()` が「未回答かどうか」しか判定していない。

```typescript
// 現状: 未回答なら早期リターン（回答済みならパネル更新を許可）
if (this.panel && !this.isAnswered) {
    return;
}
```

「回答済み・結果表示中（ユーザーがボタンを見ている）」と「回答済み・次の問題を要求した（ボタンを押した）」を区別できていない。

### 関連ファイル

- `src/quizPanel.ts`: `show()` の早期リターン条件、`onDidReceiveMessage` ハンドラ
- `media/quiz.js`: `result` メッセージ受信後にボタンを追加する処理

## 実装方針

### 新しいフラグ `isShowingResult` を追加する

| 状態 | `isAnswered` | `isShowingResult` | watcher の `show()` | ユーザー起点の `show()` |
|---|---|---|---|---|
| 回答待ち | false | false | ブロック | ブロック |
| 結果表示中 | true | true | **ブロック（修正点）** | 許可 |
| 次の問題を要求中 | true | false | ブロック | 許可 |

### 変更内容

#### `src/quizPanel.ts`

1. `private isShowingResult = false` プロパティを追加
2. `answer` ハンドラ内: `this.isShowingResult = true` を追加（resultメッセージ送信前）
3. `nextQuiz` ハンドラ内: `this.isShowingResult = false` を追加（onNextQuiz() 呼び出し前）
4. `show()` の早期リターン条件を変更:
   ```typescript
   // 変更前
   if (this.panel && !this.isAnswered) { return; }

   // 変更後
   if (this.panel && (!this.isAnswered || this.isShowingResult)) { return; }
   ```
5. `reset()` に `this.isShowingResult = false` を追加
6. `onDidDispose` コールバックに `this.isShowingResult = false` を追加（クリーンアップ）

## 修正対象ファイル

| ファイル | 変更内容 |
|---|---|
| `src/quizPanel.ts` | `isShowingResult` フラグの追加・管理 |

## 注意事項

- `media/quiz.js` の変更は不要（バグは quizPanel.ts 側の状態管理の問題）
- `reset()` は StateWatcher の stop コールバックから呼ばれる。Claude が停止したタイミングでリセットされるため、`isShowingResult` もクリアして次のクイズ生成を許可する必要がある
- パネルが閉じられたとき（`onDidDispose`）も `isShowingResult` をリセットする（`panel = null` で自然に無効化されるが、明示的にクリアしておく）
