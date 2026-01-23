// If you have a TextLoader class in here as well:
import * as fs from 'fs/promises';
import { Document } from '../types/document.js';

export class TextLoader {
  async load(filePath: string): Promise<Document> {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      content,
      metadata: {
        source: filePath,
        category: 'thematic_dna'
      },
    };
  }
}