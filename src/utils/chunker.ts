import { Document } from '../types/document.ts'

export interface ChunkConfig {
  chunkSize: number;
  chunkOverlap: number;
}

export class TextChunker {
  private config: ChunkConfig;

  constructor(config: ChunkConfig = { chunkSize: 500, chunkOverlap: 50 }) {
    this.config = config;
  }

  chunkDocument(document: Document): Document[] {
    const { content, metadata } = document;
    const chunks: Document[] = [];

    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < content.length) {
      const endIndex = Math.min(startIndex + this.config.chunkSize, content.length);
      const chunk = content.slice(startIndex, endIndex);

      chunks.push({
        content: chunk,
        metadata: {
          ...metadata,
          chunkIndex,
        },
      });

      chunkIndex++;
      startIndex += this.config.chunkSize - this.config.chunkOverlap;
    }

    return chunks;
  }
}

