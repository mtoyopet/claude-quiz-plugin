# VS Code Claude Quiz Plugin 実装計画

## タスク概要

Claude Code が処理中（考え中）のタイミングで、IT技術に関連したクイズを VS Code のパネルに表示するプラグインを作成する。

---

## 実装方針

### フェーズ1: プロジェクト基盤

VS Code Extension の雛形を作成し、基本構造を整える。

### フェーズ2: Claude Code 状態検知 + セッションコンテキスト収集

Claude Code Hooks を使い、処理中/完了のタイミングと**セッションのトピック情報**を同時に収集する。

#### 状態シグナル

- `PreToolUse` フック → 処理開始シグナル（+ ツール情報を付与）
- `Stop` フック → 処理完了シグナル
- シグナルは `/tmp/claude_quiz_state.json` ファイルへ JSON 形式で書き込み
- VS Code Extension 側で `fs.watch` により検知

#### セッションコンテキストの収集方法

`PreToolUse` フックには環境変数でツール情報が渡される。これを使いセッションのトピックを推定する。

フックが書き込む JSON 例:
```json
{
  "status": "start",
  "tool": "Bash",
  "input": "terraform plan",
  "timestamp": "2026-03-11T10:00:00Z"
}
```

#### コンテキスト蓄積とトピック推定

`src/sessionContext.ts` がセッション中のツール呼び出し履歴を蓄積し、キーワードベースでトピックを推定する。

```
履歴例:
  tool=Bash, input="terraform plan"
  tool=Read, input="main.tf"
  tool=Bash, input="terraform apply"

→ トピック推定: "terraform"
```

推定ロジック:
1. ツール引数・ファイル名からキーワード抽出（terraform, docker, kubernetes, react, etc.）
2. 最頻出キーワードをセッショントピックとして確定
3. トピックが不明な場合は汎用 IT クイズにフォールバック

### フェーズ3: コンテキスト連動クイズ生成

Anthropic API を使い、**推定したセッショントピック**に基づいたクイズを生成する。

- モデル: `claude-haiku-4-5-20251001`（高速・低コスト）
- トピックをプロンプトに含めてクイズを動的生成
- フォールバック: 静的問題バンク（API未設定時、またはトピック不明時）

#### Anthropic API へのプロンプト例

```
セッションのトピック: terraform

以下の形式で terraform に関するクイズを1問生成してください。
難易度は中級程度。

{
  "question": "...",
  "choices": ["...", "...", "...", "..."],
  "answer": 0,  // choices の正解インデックス
  "explanation": "..."
}
```

#### クイズ形式

```json
{
  "topic": "terraform",
  "question": "terraform plan コマンドの主な目的は何ですか？",
  "choices": [
    "インフラの変更を実際に適用する",
    "実行前に変更内容をプレビューする",
    "状態ファイルを初期化する",
    "リソースを削除する"
  ],
  "answer": 1,
  "explanation": "terraform plan は apply を実行する前に、どのようなリソースが作成・変更・削除されるかを確認するためのコマンドです。"
}
```

### フェーズ4: WebView UI

VS Code WebView パネルでクイズを表示する。

- Claude Code が処理を開始したらパネルを表示
- 選択肢ボタンで回答
- 回答後に正誤と解説を表示
- Claude Code が応答を返したらパネルを閉じる（または結果を残す）

---

## ディレクトリ構成

```
claude_quiz_plugin/
├── src/
│   ├── extension.ts          # エントリーポイント、コマンド登録
│   ├── stateWatcher.ts       # ファイル監視、Claude Code 状態検知
│   ├── sessionContext.ts     # セッションコンテキスト蓄積・トピック推定
│   ├── quizGenerator.ts      # Anthropic API クイズ生成（トピック連動）
│   ├── quizPanel.ts          # WebView パネル管理
│   └── staticQuestions.ts    # 静的問題バンク（フォールバック用）
├── media/
│   ├── quiz.css              # WebView スタイル
│   └── quiz.js               # WebView スクリプト
├── docs/
│   └── plans/
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

---

## 修正対象ファイル（新規作成）

| ファイル | 内容 |
|---------|------|
| `package.json` | Extension メタデータ、依存関係、コマンド定義 |
| `src/extension.ts` | activate / deactivate、コマンド登録 |
| `src/stateWatcher.ts` | `/tmp/claude_quiz_state.json` の fs.watch |
| `src/sessionContext.ts` | ツール履歴蓄積・キーワード抽出・トピック推定 |
| `src/quizGenerator.ts` | トピックを受け取り Anthropic SDK でクイズ生成 |
| `src/quizPanel.ts` | WebView パネルの表示・更新・破棄 |
| `src/staticQuestions.ts` | 静的クイズ問題バンク（トピック別、各10問程度） |
| `media/quiz.css` | WebView のスタイル |
| `media/quiz.js` | WebView 内の操作ロジック |
| `tsconfig.json` | TypeScript 設定 |
| `.vscodeignore` | パッケージング除外設定 |

---

## Claude Code Hooks 設定（ユーザー環境へのセットアップ）

`~/.claude/settings.json` に以下を追加（Extension のセットアップコマンドで自動設定）:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo \"{\\\"status\\\":\\\"start\\\",\\\"tool\\\":\\\"$CLAUDE_TOOL_NAME\\\",\\\"input\\\":\\\"$CLAUDE_TOOL_INPUT\\\"}\" > /tmp/claude_quiz_state.json"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"status\":\"stop\"}' > /tmp/claude_quiz_state.json"
          }
        ]
      }
    ]
  }
}
```

### Hooks の環境変数（Claude Code が自動注入）

| 変数名 | 内容 |
|-------|------|
| `CLAUDE_TOOL_NAME` | 使用するツール名（例: `Bash`, `Read`, `Write`） |
| `CLAUDE_TOOL_INPUT` | ツールの引数（例: Bash なら実行コマンド文字列） |

### トピック推定キーワード例

| トピック | 検出キーワード |
|---------|-------------|
| terraform | terraform, .tf, tfstate |
| docker | docker, Dockerfile, docker-compose |
| kubernetes | kubectl, k8s, helm, .yaml（namespace等） |
| react | react, jsx, tsx, useState, useEffect |
| typescript | typescript, tsc, tsconfig, .ts |
| python | python, pip, .py, pytest |
| git | git, commit, branch, merge, rebase |
| sql | SELECT, INSERT, UPDATE, .sql, migration |

---

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| Extension 本体 | TypeScript + VS Code Extension API |
| クイズ生成 | `@anthropic-ai/sdk` |
| 状態検知 | Node.js `fs.watch` |
| UI | VS Code WebView (HTML/CSS/JS) |
| ビルド | `vsce` (VS Code Extension CLI) |

---

## 注意事項

- Anthropic API キーは VS Code の設定（`settings.json`）から取得し、コードに埋め込まない
- API キー未設定時は静的問題バンクにフォールバック
- WebView は `acquireVsCodeApi()` を使い Extension 本体と通信
- `/tmp/claude_quiz_state` はプラットフォーム依存（Windows では別パスが必要。初期実装は macOS/Linux のみ対応）
- 処理が短時間（1秒未満）の場合はクイズを表示しない（ちらつき防止のためデバウンス処理を入れる）

---

## 実装順序

1. `package.json` + `tsconfig.json` でプロジェクト初期化
2. `src/extension.ts` の基本構造
3. `src/stateWatcher.ts` の状態検知（JSON ファイル監視）
4. `src/sessionContext.ts` のコンテキスト蓄積・トピック推定
5. `src/staticQuestions.ts` の静的問題バンク（トピック別）
6. `src/quizPanel.ts` + `media/` の WebView UI
7. `src/quizGenerator.ts` の Anthropic API 連携（トピック連動）
8. セットアップコマンド（Hooks 自動設定）
9. 動作確認・調整
