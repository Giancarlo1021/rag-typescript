import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Document as LangChainDocument } from "@langchain/core/documents";
import { Document } from "../types/document.js";
import "dotenv/config";

const chromaUrl = process.env.CHROMA_URL;
const embeddingModel = process.env.EMBEDDING_MODEL;
const collectionName = process.env.COLLECTION_NAME;

export class VectorStoreManager {
  private embeddings: OllamaEmbeddings;
  private collectionName: string = collectionName;
  private dbUrl: string;
  private logger: (message: string) => void;

  constructor(
    dbUrl: string = chromaUrl,
    logger: (message: string) => void = console.log,
  ) {
    this.dbUrl = dbUrl;
    this.logger = logger;

    this.embeddings = new OllamaEmbeddings({
      model: embeddingModel,
      baseUrl: process.env.OLLAMA_BASE_URL,
    });
  }

  /**
   * Helper to get a connection to the vector store
   */
  public getStore(): Chroma {
    return new Chroma(this.embeddings, {
      collectionName: this.collectionName,
      url: this.dbUrl,
    });
  }

  /**
   * Delete documents by metadata filter
   */
  async deleteDocuments(filter: object): Promise<void> {
    try {
      const vectorStore = this.getStore();
      const collection = await vectorStore.ensureCollection();
      await collection.delete(filter);
    } catch (e) {
      this.logger(`Error deleting documents: ${e}`);
    }
  }

  /**
   * Clear all documents from the collection
   */
  async clearCollection(): Promise<void> {
    try {
      const vectorStore = this.getStore();
      const collection = await vectorStore.ensureCollection();
      await collection.delete({ where: {} });
    } catch (e) {
      this.logger(`Error clearing collection: ${e}`);
    }
  }

  async getCount(): Promise<number> {
    try {
      const vectorStore = this.getStore();
      const collection = await vectorStore.ensureCollection();
      return await collection.count();
    } catch (error) {
      this.logger("No existing collection found.");
      return 0;
    }
  }

  /**
   * Search for a file in the metadata to see if it's already there
   */
  async searchMetadata(filter: object): Promise<any[]> {
    try {
      const vectorStore = this.getStore();
      // Similarity search with a dummy query to check for existing metadata
      return await vectorStore.similaritySearch("test", 1, filter);
    } catch (e) {
      return [];
    }
  }

  async addDocuments(chunks: Document[]) {
    const langChainDocs = chunks.map(
      (chunk) =>
        new LangChainDocument({
          pageContent: chunk.content,
          metadata: {
            ...chunk.metadata,
            category: chunk.metadata.category || "uncategorized",
            ingested_at: Date.now(),
          },
        }),
    );

    this.logger(`🚀 Starting ingestion of ${chunks.length} chunks...`);

    const vectorStore = this.getStore();

    const batchSize = 100;
    for (let i = 0; i < langChainDocs.length; i += batchSize) {
      const batch = langChainDocs.slice(i, i + batchSize);
      await vectorStore.addDocuments(batch);

      const progress = Math.min(i + batchSize, langChainDocs.length);
      this.logger(
        `📦 Progress: ${progress}/${langChainDocs.length} chunks embedded...`,
      );
    }

    this.logger("✅ Ingestion complete!");
    return vectorStore;
  }
}
