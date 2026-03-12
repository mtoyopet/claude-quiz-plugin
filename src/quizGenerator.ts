import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';
import { Quiz } from './quizPanel';

const PROMPT = (topic: string) => `
あなたはIT技術のクイズを作成する専門家です。
以下のトピックに関するクイズを1問生成してください。

トピック: ${topic}
難易度: 中級程度
言語: 日本語

問題の種類は以下のいずれかに限定してください：
- 概念理解問題（用語の定義、仕組み、原則の理解）
- コマンド/構文理解問題（CLIコマンド、APIの使い方、オプションの意味）

以下の種類の問題は生成しないでください：
- コードスニペットの実行結果・出力を問う問題（コードリーディング問題）

以下のJSONフォーマットのみで回答してください。説明文や前後の文章は不要です。

{
  "question": "質問文",
  "choices": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
  "answer": 0,
  "explanation": "解説文"
}

answerは正解の選択肢のインデックス（0〜3）です。
`.trim();

export async function generateQuiz(topic: string | null): Promise<Quiz> {
    const apiKey = vscode.workspace.getConfiguration('claudeQuiz').get<string>('anthropicApiKey');
    if (!apiKey) {
        throw new Error('Anthropic API キーが設定されていません。設定から claudeQuiz.anthropicApiKey を設定してください。');
    }

    const client = new Anthropic({ apiKey });
    const effectiveTopic = topic ?? 'IT技術全般';

    const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: PROMPT(effectiveTopic) }],
    });

    const raw  = message.content.find(b => b.type === 'text')?.text ?? '';
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const json = JSON.parse(text);

    return {
        topic: effectiveTopic,
        question: json.question,
        choices: json.choices,
        answer: json.answer,
        explanation: json.explanation,
    };
}