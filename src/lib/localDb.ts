import fs from 'fs/promises';
import path from 'path';

export interface SavedGrocery {
    id: string;
    product_id: string;
    name: string;
    price: number;
    location_id: string;
    zip: string;
    image_url: string | null;
    quantity: number;
    unit: string | null;
    brand: string | null;
    created_at: string;
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'saved_groceries.json');

// A simple promise chain queue to serialize reads and writes and avoid race conditions
let queue = Promise.resolve();

async function runQueued<T>(op: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        queue = queue.then(async () => {
            try {
                const res = await op();
                resolve(res);
            } catch (err) {
                reject(err);
            }
        });
    });
}

async function ensureFileExists() {
    try {
        await fs.mkdir(DB_DIR, { recursive: true });
        await fs.access(DB_FILE);
    } catch {
        // File or directory doesn't exist, create it with empty array
        await fs.writeFile(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
    }
}

export async function readDb(): Promise<SavedGrocery[]> {
    return runQueued(async () => {
        await ensureFileExists();
        const data = await fs.readFile(DB_FILE, 'utf-8');
        try {
            return JSON.parse(data) as SavedGrocery[];
        } catch {
            return [];
        }
    });
}

export async function writeDb(items: SavedGrocery[]): Promise<void> {
    return runQueued(async () => {
        await fs.mkdir(DB_DIR, { recursive: true });
        await fs.writeFile(DB_FILE, JSON.stringify(items, null, 2), 'utf-8');
    });
}
