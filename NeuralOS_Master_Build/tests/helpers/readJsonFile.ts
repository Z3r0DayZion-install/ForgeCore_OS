import fs from 'fs';

export function readJsonFile<T = unknown>(filePath: string): T | undefined {
    try {
        if (!fs.existsSync(filePath)) {
            return undefined;
        }

        const raw = fs.readFileSync(filePath, 'utf-8');
        if (raw.trim().length === 0) {
            return undefined;
        }

        return JSON.parse(raw) as T;
    } catch {
        return undefined;
    }
}
