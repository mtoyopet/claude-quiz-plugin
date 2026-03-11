import * as fs from 'fs';
import * as path from 'path';

export interface StateEvent {
    status: 'start' | 'stop';
    tool?: string;
    input?: string;
    timestamp: string;
}

export class StateWatcher {
    private readonly stateFilePath = '/tmp/claude_quiz_state.json';
    private watcher: fs.FSWatcher | null = null;
    private onStart: (event: StateEvent) => void;
    private onStop: (event: StateEvent) => void;

    constructor(onStart: (event: StateEvent) => void, onStop: (event: StateEvent) => void) {
        this.onStart = onStart;
        this.onStop = onStop;
    }

    start(): void {
        if (!fs.existsSync(this.stateFilePath)) {
            fs.writeFileSync(this.stateFilePath, '{}', 'utf-8');
        }
        this.watcher = fs.watch(this.stateFilePath, () => {
            this.onFileChange();
        });
    }

    stop(): void {
        this.watcher?.close();
        this.watcher = null;
    }

    private onFileChange(): void {
        try {
            const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
            const event = JSON.parse(raw) as StateEvent;
            if (event.status === 'start') {
                this.onStart(event);
            } else if (event.status === 'stop') {
                this.onStop(event);
            }
        } catch {
            // ファイルが空・不正なJSONの場合は無視
        }
    }
}