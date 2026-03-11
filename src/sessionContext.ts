import { StateEvent } from './stateWatcher';

const TOPIC_KEYWORDS: Record<string, string[]> = {
    terraform: ['terraform', 'tf', 'tfstate'],
    docker: ['docker', 'dockerfile', 'docker-compose'],
    kubernetes:  ['kubectl', 'k8s', 'helm'],
    react:       ['react', '.jsx', '.tsx', 'usestate', 'useeffect'],
    typescript:  ['typescript', 'tsc', 'tsconfig', '.ts'],
    python:      ['python', 'pip', '.py', 'pytest'],
    git:         ['git', 'commit', 'branch', 'merge', 'rebase'],
    sql:         ['select', 'insert', 'update', '.sql', 'migration'],
    aws: ['aws', 'ec2', 's3', 'lambda', 'cloudformation', 'iam', 'eks', 'rds'],
};

export class SessionContext {
    private history: StateEvent[] = [];

    addEvent(event: StateEvent): void {
        this.history.push(event);
    }

    inferTopic(): string | null {
        const scores: Record<string, number> = {};

        for (const event of this.history) {
            const text = `${event.tool ?? ''} ${event.input ?? ''}`.toLowerCase();
            for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
                for (const kw of keywords) {
                    if (text.includes(kw)) {
                        scores[topic] = (scores[topic] ?? 0) + 1;
                    }
                }
            }
        }

        const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
        return top ? top[0] : null;
    }

    reset(): void {
        this.history = [];
    }
}