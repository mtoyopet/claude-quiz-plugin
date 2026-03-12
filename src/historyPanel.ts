import * as vscode from 'vscode';
import { QuizHistory, QuizRecord } from './quizHistory';

export class HistoryPanel {
    private panel: vscode.WebviewPanel | null = null;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly history: QuizHistory,
    ) {}

    show(): void {
        if (this.panel) {
            this.panel.webview.html = this.buildHtml();
            this.panel.reveal();
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'claudeQuizHistory',
            'Claude Quiz: 履歴',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
            }
        );

        this.panel.onDidDispose(() => {
            this.panel = null;
        });

        this.panel.webview.onDidReceiveMessage((msg) => {
            if (msg.type === 'clearHistory') {
                this.history.clear();
                this.panel?.webview.postMessage({ type: 'cleared' });
            }
        });

        this.panel.webview.html = this.buildHtml();
    }

    refresh(): void {
        if (this.panel) {
            this.panel.webview.html = this.buildHtml();
        }
    }

    private buildHtml(): string {
        const records = this.history.getAll();
        const total = records.length;
        const correct = records.filter(r => r.isCorrect).length;
        const rate = total > 0 ? Math.round((correct / total) * 100) : 0;
        const nonce = getNonce();
        const cssUri = this.panel!.webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'media', 'quiz.css')
        );
        const cspSource = this.panel!.webview.cspSource;

        const recordsHtml = records.length === 0
            ? '<p style="color:var(--vscode-descriptionForeground)">まだ履歴がありません。</p>'
            : records.map(r => renderRecord(r)).join('');

        return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${cssUri}">
  <style>
    .summary { margin-bottom: 20px; }
    .summary h2 { margin: 0 0 4px; font-size: 1.1em; }
    .record { border: 1px solid var(--vscode-panel-border); border-radius: 6px; padding: 12px; margin-bottom: 12px; }
    .record-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .badge { font-size: 1.1em; }
    .badge.correct { color: var(--vscode-testing-iconPassed, #2d7a2d); }
    .badge.incorrect { color: var(--vscode-testing-iconFailed, #c72e2e); }
    .record-meta { font-size: 0.75em; color: var(--vscode-descriptionForeground); }
    .record-question { font-weight: bold; margin-bottom: 6px; }
    .record-answer { font-size: 0.9em; }
    .record-answer .user-answer { margin-bottom: 2px; }
    .record-answer .correct-answer { color: var(--vscode-testing-iconPassed, #2d7a2d); }
    .record-answer .wrong-answer { color: var(--vscode-testing-iconFailed, #c72e2e); }
    .explanation-text { font-size: 0.85em; color: var(--vscode-descriptionForeground); margin-top: 6px; }
    #clear-btn { margin-top: 8px; padding: 6px 14px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; cursor: pointer; font-size: inherit; }
    #clear-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
  </style>
</head>
<body>
  <div class="summary">
    <h2>クイズ履歴</h2>
    <div>正解率: <strong>${correct} / ${total} (${rate}%)</strong></div>
    <button id="clear-btn">履歴をクリア</button>
  </div>
  ${recordsHtml}
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('clear-btn').addEventListener('click', () => {
      if (confirm('履歴をすべて削除しますか？')) {
        vscode.postMessage({ type: 'clearHistory' });
      }
    });
    window.addEventListener('message', (e) => {
      if (e.data.type === 'cleared') {
        document.querySelectorAll('.record').forEach(el => el.remove());
        document.querySelector('.summary div').textContent = '正解率: 0 / 0 (0%)';
      }
    });
  </script>
</body>
</html>`;
    }
}

function renderRecord(r: QuizRecord): string {
    const date = new Date(r.timestamp).toLocaleString('ja-JP', {
        month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
    });
    const badgeClass = r.isCorrect ? 'correct' : 'incorrect';
    const badgeIcon = r.isCorrect ? '✓' : '✗';
    const userAnswerText = escapeHtml(r.choices[r.userAnswer] ?? '');
    const correctAnswerText = escapeHtml(r.choices[r.correctAnswer] ?? '');

    const answerHtml = r.isCorrect
        ? `<div class="user-answer correct-answer">あなたの回答: ${userAnswerText}</div>`
        : `<div class="user-answer wrong-answer">あなたの回答: ${userAnswerText}</div>
           <div class="correct-answer">正解: ${correctAnswerText}</div>`;

    return `
<div class="record">
  <div class="record-header">
    <span class="badge ${badgeClass}">${badgeIcon}</span>
    <span class="record-meta">${date} &nbsp;|&nbsp; ${escapeHtml(r.topic)}</span>
  </div>
  <div class="record-question">${escapeHtml(r.question)}</div>
  <div class="record-answer">${answerHtml}</div>
  <div class="explanation-text">${escapeHtml(r.explanation)}</div>
</div>`;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
