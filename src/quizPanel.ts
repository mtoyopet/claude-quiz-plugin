import * as vscode from 'vscode';

export interface Quiz {
    topic: string;
    question: string;
    choices: string[];
    answer: number;
    explanation: string;
}

export class QuizPanel {
    private panel: vscode.WebviewPanel | null = null;
    private readonly extensionUri: vscode.Uri;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
    }

    show(quiz: Quiz): void {
        if (this.panel) {
            this.panel.webview.html = this.buildHtml(quiz);
            this.panel.reveal();
            return
        }

        this.panel = vscode.window.createWebviewPanel(
            'claudeQuiz',
            'Claude Quiz',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
            }
        );

        this.panel.onDidDispose(() => { this.panel = null; })

        this.panel.webview.onDidReceiveMessage((msg) => {
            if (msg.type === 'answer') {
                this.panel?.webview.postMessage({
                    type: 'result',
                    correct: msg.index === quiz.answer,
                    answer: quiz.answer,
                    explanation: quiz.explanation
                })
            }
        })

        this.panel.webview.html = this.buildHtml(quiz);
    }

    dispose(): void {
        this.panel?.dispose();
        this.panel = null;
    }

    private buildHtml(quiz: Quiz): string {
        const webview = this.panel!.webview;
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'quiz.css'));
        const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'quiz.js'));
        const nonce = getNonce();
        const data = JSON.stringify(quiz).replace(/</g, '\\u003c');

        return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${cssUri}">
</head>
<body>
  <script nonce="${nonce}">window.__quiz=${data};</script>
  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
    }
}


function getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}