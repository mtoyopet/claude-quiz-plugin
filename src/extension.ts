import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const setupHooks = vscode.commands.registerCommand('claudeQuiz.setupHooks', () => {
    vscode.window.showInformationMessage('Claude Quiz: Hooks setup is not yet implemented.');
  });

  const showQuiz = vscode.commands.registerCommand('claudeQuiz.showQuiz', () => {
    vscode.window.showInformationMessage('Claude Quiz: Show quiz is not yet implemented.');
  });

  context.subscriptions.push(setupHooks, showQuiz);
}

export function deactivate() {}
