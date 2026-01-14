import * as fs from 'fs/promises';

export interface Document {
  content: string;
  metadata: {
    source: string;
    chunkIndex?: number;
  };
}

export class TextLoader {
  async load(filePath: string): Promise<Document> {
    const content = await fs.readFile(filePath, 'utf-8');
    return {
      content,
      metadata: {
        source: filePath,
      },
    };
  }
}
