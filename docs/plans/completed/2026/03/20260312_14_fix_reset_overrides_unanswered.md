# 20260312_14 未回答クイズが reset() で上書きされるバグ修正

## タスク概要

Claudeが動作中に問題を表示した後、Claudeが停止→再開すると未回答の問題が新しい問題に切り替わってしまうバグを修正する。

## 現状調査結果

### バグの再現フロー

1. Claudeが動作 → デバウンス(1秒)後に `generateQuiz()` → `quizPanel.show(quiz)` 呼び出し
2. `show()` 内で `isAnswered = false` にセット（問題表示中）
3. Claudeが停止 → `StateWatcher` の onStop コールバック → `quizPanel.reset()` 呼び出し
4. **`reset()` が `isAnswered = true` にセット** ← ここが問題
5. Claudeが再び動作 → デバウンス後に新しい `generateQuiz()` → `quizPanel.show(quiz)` 呼び出し
6. `show()` のガード条件: `this.panel && (!this.isAnswered || this.isShowingResult)`
   - = `true && (!true || false)` = `true && false` = `false` → ガードを通過
7. 未回答の問題が新しい問題で上書きされる

### 関連コード

**`src/quizPanel.ts:27`** - `show()` のガード条件:
```typescript
if (this.panel && (!this.isAnswered || this.isShowingResult)) {
    return;
}
```

**`src/quizPanel.ts:92`** - `reset()`:
```typescript
reset(): void {
    this.isAnswered = true;  // ← ここが不要
    this.isShowingResult = false;
}
```

**`src/extension.ts:56-59`** - onStop コールバック:
```typescript
sessionContext.reset();
quizPanel.reset();
```

### `isAnswered` のライフサイクル（現状）

| タイミング | 値 | 設定箇所 |
|---|---|---|
| 初期値 | `true` | クラス定義 |
| 問題表示時 | `false` | `show()` |
| ユーザー回答時 | `true` | `onDidReceiveMessage` (answer) |
| パネルクローズ時 | `true` | `onDidDispose` |
| **セッションリセット時** | **`true`** | **`reset()` ← 問題** |

## 実装方針

`reset()` から `this.isAnswered = true` の行を削除する。

`isAnswered` は以下の場合のみ `true` にするべき：
- ユーザーが回答したとき（`onDidReceiveMessage` で `msg.type === 'answer'`）
- パネルが閉じられたとき（`onDidDispose`）

Claudeのセッション終了は「ユーザーが回答した」とは無関係なので、`reset()` で `isAnswered` を上書きすべきでない。

`isShowingResult = false` のリセットは引き続き必要（結果表示中にパネルが固まらないようにするため）。

## 修正対象ファイル

- `src/quizPanel.ts` - `reset()` メソッドから `this.isAnswered = true;` を削除

## 変更内容

```typescript
// 変更前
reset(): void {
    this.isAnswered = true;
    this.isShowingResult = false;
}

// 変更後
reset(): void {
    this.isShowingResult = false;
}
```

## 注意事項

- `isAnswered` の初期値は `true` のままでよい（最初はパネルがないので問題なし）
- `onDidDispose` での `isAnswered = true` も引き続き必要（パネルを閉じたら次の問題を受け入れられるようにする）
- この修正により、未回答中は何度Claudeが停止・再開してもクイズが切り替わらなくなる
