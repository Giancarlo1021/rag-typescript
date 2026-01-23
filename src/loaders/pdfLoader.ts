import * as fs from 'fs/promises';
// @ts-ignore
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { Document } from '../types/document.js';
import path from 'path';

export class PdfLoader {
    // 1. Define your category mapping here
    private categoryMap: Record<string, string> = {
        'Traveller': 'rules',
        'Cepheus': 'thematic_dna',
        'Agnostic': 'thematic_dna',
        'Core': 'rules'
    };

    private getCategory(filePath: string): string {
        const fileName = path.basename(filePath);

        // Find the first key from the map that exists in the filename
        for (const [keyword, category] of Object.entries(this.categoryMap)) {
            if (fileName.includes(keyword)) {
                return category;
            }
        }

        // Fallback if no keywords match
        return 'uncategorized';
    }

    async load(filePath: string): Promise<Document> {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdf(dataBuffer);

        return {
            content: data.text,
            metadata: {
                source: path.basename(filePath),
                category: this.getCategory(filePath)
            }
        };
    }
}