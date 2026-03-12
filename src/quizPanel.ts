import * as vscode from 'vscode';
import { QuizHistory } from './quizHistory';

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
    private isAnswered = true;
    private isShowingResult = false;
    private currentQuiz: Quiz | null = null;
    onNextQuiz: (() => void) | null = null;
    onShowHistory: (() => void) | null = null;

    constructor(extensionUri: vscode.Uri, private readonly history: QuizHistory) {
        this.extensionUri = extensionUri;
    }

    show(quiz: Quiz): void {
        if (this.panel && (!this.isAnswered || this.isShowingResult)) {
            return;
        }

        this.isAnswered = false;
        this.currentQuiz = quiz;

        if (this.panel) {
            this.panel.webview.html = this.buildHtml(quiz);
            this.panel.reveal();
            return;
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

        this.panel.onDidDispose(() => {
            this.panel = null;
            this.isAnswered = true;
            this.isShowingResult = false;
        });

        this.panel.webview.onDidReceiveMessage((msg) => {
            if (msg.type === 'answer') {
                this.isAnswered = true;
                this.isShowingResult = true;
                const quiz = this.currentQuiz!;
                const isCorrect = msg.index === quiz.answer;
                this.history.add({
                    topic: quiz.topic,
                    question: quiz.question,
                    choices: quiz.choices,
                    correctAnswer: quiz.answer,
                    userAnswer: msg.index,
                    isCorrect,
                    explanation: quiz.explanation,
                });
                this.panel?.webview.postMessage({
                    type: 'result',
                    correct: isCorrect,
                    answer: quiz.answer,
                    explanation: quiz.explanation,
                });
            } else if (msg.type === 'nextQuiz') {
                this.isShowingResult = false;
                this.onNextQuiz?.();
            } else if (msg.type === 'showHistory') {
                this.onShowHistory?.();
            }
        });

        this.panel.webview.html = this.buildHtml(quiz);
    }

    reset(): void {
        this.isAnswered = true;
        this.isShowingResult = false;
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