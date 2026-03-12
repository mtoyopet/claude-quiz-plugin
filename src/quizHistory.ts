import * as vscode from 'vscode';

export interface QuizRecord {
    id: string;
    timestamp: string;
    topic: string;
    question: string;
    choices: string[];
    correctAnswer: number;
    userAnswer: number;
    isCorrect: boolean;
    explanation: string;
}

const STORAGE_KEY = 'claudeQuiz.history';
const MAX_RECORDS = 200;

export class QuizHistory {
    constructor(private readonly globalState: vscode.Memento) {}

    add(record: Omit<QuizRecord, 'id' | 'timestamp'>): void {
        const records = this.getAll();
        const newRecord: QuizRecord = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            ...record,
        };
        records.unshift(newRecord);
        if (records.length > MAX_RECORDS) {
            records.splice(MAX_RECORDS);
        }
        this.globalState.update(STORAGE_KEY, records);
    }

    getAll(): QuizRecord[] {
        return this.globalState.get<QuizRecord[]>(STORAGE_KEY, []);
    }

    clear(): void {
        this.globalState.update(STORAGE_KEY, []);
    }
}
