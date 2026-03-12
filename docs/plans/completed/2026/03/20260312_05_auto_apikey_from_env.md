# 20260312_05 APIキーの自動検出（環境変数フォールバック）

## タスク概要

セットアップ画面でAPIキーを手動入力しなくても、TerminalでClaude Code CLIが動いていれば自動でAPIキーを使用できるようにする。

## 現状調査結果

- `src/quizGenerator.ts:38-41` でVSCode設定 `claudeQuiz.anthropicApiKey` からAPIキーを取得
- 未設定の場合は即エラーになる
- Anthropic SDK (`@anthropic-ai/sdk`) は `apiKey` を省略すると自動で `ANTHROPIC_API_KEY` 環境変数を読み込む仕様

## 実装方針

`generateQuiz` 関数のAPIキー取得ロジックを以下の優先順に変更する：

1. VSCode設定 `claudeQuiz.anthropicApiKey` を確認
2. なければ `process.env.ANTHROPIC_API_KEY` を確認
3. どちらもなければ Anthropic SDK に `apiKey` を渡さず（SDKが環境変数を自動読み込み）
4. それでも取得できない場合は従来通りエラーを投げる

実装上は「VSCode設定または環境変数のどちらかがあれば `apiKey` を渡す。どちらもなければ渡さない（SDK任せ）」とするのがシンプル。

## 修正対象ファイル

- `src/quizGenerator.ts` （APIキー取得ロジック、エラーメッセージ）

## 注意事項

- macOSでVSCodeをDock/Finderから起動した場合、シェルの環境変数を継承しない場合がある
  → その場合はVSCode設定にAPIキーを入力する従来の方法が有効
- エラーメッセージを「設定または環境変数 ANTHROPIC_API_KEY のどちらかを設定してください」に更新する
