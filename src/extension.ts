import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { SessionContext } from './sessionContext';
import { StateWatcher } from './stateWatcher';
import { generateQuiz } from './quizGenerator';
import { QuizPanel } from './quizPanel';
import { QuizHistory } from './quizHistory';
import { HistoryPanel } from './historyPanel';

const DEBOUNCE_MS = 1000;

export function activate(context: vscode.ExtensionContext) {
    const sessionContext = new SessionContext();
    const quizHistory = new QuizHistory(context.globalState);
    const quizPanel = new QuizPanel(context.extensionUri, quizHistory);
    const historyPanel = new HistoryPanel(context.extensionUri, quizHistory);
    let debounceTimer: NodeJS.Timeout | null = null;

    quizPanel.onShowHistory = () => historyPanel.show();

    quizPanel.onNextQuiz = async () => {
        const topic = sessionContext.inferTopic();
        try {
            const quiz = await generateQuiz(topic);
            quizPanel.show(quiz);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showWarningMessage(`Claude Quiz: ${msg}`);
        }
    };

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
            // 処理完了: デバウンスタイマーをキャンセル、コンテキスト・パネルをリセット
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                debounceTimer = null;
            }
            sessionContext.reset();
            quizPanel.reset();
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
                        command: `python3 -c "import sys,json; d=json.load(sys.stdin); open('/tmp/claude_quiz_state.json','w').write(json.dumps({'status':'start','tool':d.get('tool_name',''),'input':str(d.get('tool_input',''))}))"`,
                    }],
                }],
                Stop: [{
                    hooks: [{
                        type: 'command',
                        command: `echo '{"status":"stop"}' > /tmp/claude_quiz_state.json`,
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
        quizPanel.enableCreate();
        const topic = sessionContext.inferTopic();
        try {
            const quiz = await generateQuiz(topic);
            quizPanel.show(quiz);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            vscode.window.showWarningMessage(`Claude Quiz: ${msg}`);
        }
    });

    const showHistory = vscode.commands.registerCommand('claudeQuiz.showHistory', () => {
        historyPanel.show();
    });

    context.subscriptions.push(setupHooks, showQuiz, showHistory, { dispose: () => watcher.stop() });
}

export function deactivate() {}
