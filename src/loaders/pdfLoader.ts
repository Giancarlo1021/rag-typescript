import * as fs from 'fs/promises';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { Document } from './textLoader.js';

export class PdfLoader {
    async load(filePath: string): Promise<Document> {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);

        return {
            content: data.text,
            metadata: {
                source: filePath,
            },
        };
    }
}