import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { SessionContext } from './sessionContext';
import { StateWatcher } from './stateWatcher';
import { generateQuiz } from './quizGenerator';
import { QuizPanel } from './quizPanel';

const DEBOUNCE_MS = 1000;

export function activate(context: vscode.ExtensionContext) {
    const sessionContext = new SessionContext();
    const quizPanel = new QuizPanel(context.extensionUri);
    let debounceTimer: NodeJS.Timeout | null = null;

    const watcher = new StateWatcher(
        (event) => {
            // 処理開始: コンテキスト蓄積 + デバウンス後にクイズ表示
            sessionContext.addEvent(event);

            if (debounceTimer) { clearTimeout(debounceTimer); }
            debounceTimer = setTimeout(async () => {
                const topic = sessionContext.inferTopic();
                try {
                    const quiz = await generateQuiz(topic);
                    quizPanel.show(quiz);
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : String(err);
                    vscode.window.showWarningMessage(`Claude Quiz: ${msg}`);
                }
            }, DEBOUNCE_MS);
        },
        () => {
            // 処理完了: デバウンスタイマーをキャンセル、コンテキストリセット
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            sessionContext.reset();
        }
    );

    watcher.start();

    const setupHooks = vscode.commands.registerCommand('claudeQuiz.setupHooks', async () => {
        const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        try {
            let settings: Record<string, unknown> = {};
            if (fs.existsSync(settingsPath)) {
                settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
            }

            settings.hooks = {
                PreToolUse: [{
                    hooks: [{
                        type: 'command',
                        command: 'echo \'{"status":"start","tool":"$CLAUDE_TOOL_NAME","input":"$CLAUDE_TOOL_INPUT"}\' > /tmp/claude_quiz_state.json',
                    }],
                }],
                Stop: [{
                    hooks: [{
                        type: 'command',
                        command: 'echo \'{"status":"stop"}\' > /tmp/claude_quiz_state.json',
                    }],
                }],
            };

            fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
            vscode.window.showInformationMessage('Claude Quiz: Hooks を設定しました。Claude Code を再起動してください。');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showErrorMessage(`Claude Quiz: Hooks 設定に失敗しました: ${msg}`);
        }
    });

    const showQuiz = vscode.commands.registerCommand('claudeQuiz.showQuiz', async () => {
        const topic = sessionContext.inferTopic();
        try {
            const quiz = await generateQuiz(topic);
            quizPanel.show(quiz);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showWarningMessage(`Claude Quiz: ${msg}`);
        }
    });

    context.subscriptions.push(setupHooks, showQuiz, { dispose: () => watcher.stop() });
}

export function deactivate() {}
