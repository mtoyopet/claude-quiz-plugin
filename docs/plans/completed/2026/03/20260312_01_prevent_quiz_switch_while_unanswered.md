# クイズ切り替え防止（未回答中は上書きしない）

## タスク概要

Claudeが考え中に複数の `PreToolUse` が発火し、`QuizPanel.show()` が繰り返し呼ばれてクイズが差し替わる問題を修正する。

---

## 現状調査結果

### 問題の流れ

1. `PreToolUse` フックがツール呼び出しのたびに発火 → `start` イベント
2. `extension.ts` のデバウンス（1秒）がリセットされ続ける
3. デバウンスが通過するたびに `generateQuiz()` → `quizPanel.show()` が呼ばれる
4. `QuizPanel.show()` は既存パネルがあっても `buildHtml()` でHTML上書き（quizPanel.ts:21）
5. 結果として回答中のクイズが差し替わる

### 関連ファイル

- `src/quizPanel.ts` — `show()` の上書きロジック、`onDidReceiveMessage` の回答ハンドラ
- `src/extension.ts` — `onStart` / `onStop` のコールバック

---

## 実装方針（案2）

`QuizPanel` に `isAnswered` フラグを持たせ、未回答中は `show()` で上書きしない。

### QuizPanel の変更

```typescript
private isAnswered = true;  // 初期状態はtrue（パネル未表示 = 表示可能）
```

**`show()` の変更:**
- `this.panel` が存在 かつ `this.isAnswered === false` の場合 → 何もせず return
- それ以外 → クイズ表示し `isAnswered = false` にセット

**`onDidReceiveMessage` の変更:**
- `answer` メッセージ受信時に `this.isAnswered = true` にセット

**`reset()` メソッドを追加:**
- `isAnswered = true` にリセット（stopイベント時に呼ぶ用）

### extension.ts の変更

- `onStop` コールバックで `quizPanel.reset()` を呼ぶ

---

## 修正対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/quizPanel.ts` | `isAnswered` フラグ追加、`show()` に上書きガード、回答時にフラグON、`reset()` メソッド追加 |
| `src/extension.ts` | `onStop` で `quizPanel.reset()` を呼ぶ |

---

## 注意事項

- `isAnswered` の初期値は `true`（= 最初は表示可能な状態）
- パネルが閉じられた場合（`onDidDispose`）も `isAnswered = true` に戻す
- `stop` イベント時に `reset()` を呼ぶことで、次のClaude処理開始時に新クイズを出せるようにする

---

## 実装順序

1. `src/quizPanel.ts` に `isAnswered` フラグ追加
2. `show()` に未回答ガードを追加
3. `onDidReceiveMessage` で回答時に `isAnswered = true` にセット
4. `reset()` メソッドを追加
5. `src/extension.ts` の `onStop` で `quizPanel.reset()` を呼ぶ
