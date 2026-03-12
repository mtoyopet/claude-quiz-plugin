# 20260312_13 パネルが重複して立ち上がる不具合の修正

## タスク概要

クイズパネルが開いているのに別のパネルが立ち上がる（または閉じたのにすぐ再表示される）不具合を修正する。

## 現状調査結果

### バグの再現フロー

```
1. パネルが開いている
2. StateWatcher が発火 → generateQuiz() を非同期開始
3. ユーザーがパネルを閉じる → onDidDispose: this.panel = null
4. generateQuiz() が完了 → show() 呼び出し
5. this.panel === null → createWebviewPanel() 実行 → 新規パネル生成 ← BUG
```

### 問題箇所

`src/quizPanel.ts` の `show()` メソッド:

```typescript
show(quiz: Quiz): void {
    if (this.panel && (!this.isAnswered || this.isShowingResult)) {
        return;
    }
    // ...
    if (this.panel) {
        // 既存パネル更新
        return;
    }
    // this.panel が null の場合、無条件に新規パネル生成 ← 問題
    this.panel = vscode.window.createWebviewPanel(...);
}
```

`this.panel === null` のとき、それがユーザーがパネルを閉じた結果なのか、まだ一度も表示されていない初期状態なのかを区別できていない。

### 副次的な問題

`show()` が `this.panel.reveal()` を呼ぶため、StateWatcher によるクイズ更新の都度、パネルが前面に飛び出す可能性がある（ユーザーがコーディング中に突然パネルが前面に出る）。

## 実装方針

### `allowCreate` フラグを追加する

| 状態 | `allowCreate` | `this.panel` | 新規パネル生成 |
|---|---|---|---|
| 初回（未表示） | true | null | 許可 |
| パネル表示中 | true | non-null | 不要（更新） |
| ユーザーがパネルを閉じた後 | **false** | null | **ブロック** |
| `showQuiz` コマンド実行時 | true（enableCreate で復元） | null | 許可 |

### 変更内容

#### `src/quizPanel.ts`

1. `private allowCreate = true` プロパティを追加
2. `onDidDispose` 内: `this.allowCreate = false` を追加
3. `show()` に早期リターン条件を追加:
   ```typescript
   if (!this.panel && !this.allowCreate) {
       return;  // ユーザーが閉じたパネルを自動で再生成しない
   }
   ```
4. `public enableCreate(): void { this.allowCreate = true; }` メソッドを追加
5. `reset()` では `allowCreate` を変更しない（パネルが閉じていない限り次のクイズを受け入れるため）

#### `src/extension.ts`

1. `showQuiz` コマンド内: `generateQuiz()` の前に `quizPanel.enableCreate()` を呼び出す
   - コマンドパレットからの明示的なリクエストは常に新規パネル生成を許可する

### `onNextQuiz` についての判断

`onNextQuiz` はパネル内のボタンからのみ呼ばれる（パネルが開いていないと呼べない）。
`generateQuiz()` の待機中にユーザーがパネルを閉じても新規パネルを生成しない（ユーザーが閉じた意図を尊重）。
`enableCreate()` は呼ばない。

## 修正対象ファイル

| ファイル | 変更内容 |
|---|---|
| `src/quizPanel.ts` | `allowCreate` フラグ追加、`enableCreate()` メソッド追加、`show()` に早期リターン追加、`onDidDispose` に `allowCreate = false` 追加 |
| `src/extension.ts` | `showQuiz` コマンドに `quizPanel.enableCreate()` 追加 |

## 注意事項

- `allowCreate` は `reset()` で変更しない（`reset()` は StateWatcher の stop イベントで呼ばれる。パネルがまだ開いている可能性があるため）
- `enableCreate()` は `public` にして `extension.ts` から呼べるようにする
- この修正により「ユーザーがパネルを閉じたら、次に自動で表示されることはなくなる」という UX になる。次のクイズを見るには `showQuiz` コマンドを手動実行する必要がある