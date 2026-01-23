import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Document as LangChainDocument } from "@langchain/core/documents";
import { Document } from '../types/document.js';
import 'dotenv/config';

export class VectorStoreManager {
    private embeddings: OllamaEmbeddings;
    private collectionName: string = "traveller_rag"; // Fixed name string
    private dbUrl: string;

    // The first argument passed from index.ts is actually the chromaUrl
    constructor(dbUrl: string = "http://localhost:8000") {
        this.dbUrl = dbUrl;

        this.embeddings = new OllamaEmbeddings({
            model: "qwen3-embedding:0.6b",
            // Use the .env variable if it exists, otherwise localhost
            baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        });
    }

    /**
     * 🛠️ Helper to get a connection to the vector store
     */
    public getStore(): Chroma {
        return new Chroma(this.embeddings, {
            collectionName: this.collectionName, // This is now "traveller_rag"
            url: this.dbUrl,                     // This is now "http://localhost:8000"
        });
    }

    async getCount(): Promise<number> {
        try {
            const vectorStore = this.getStore();
            // ensureCollection checks if it's alive and ready
            const collection = await vectorStore.ensureCollection();
            return await collection.count();
        } catch (error) {
            console.log("No existing collection found.");
            return 0;
        }
    }

    /**
     * 🔍 Search for a file in the metadata to see if it's already there
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
                        category: chunk.metadata.category || 'uncategorized',
                        ingested_at: Date.now()
                    },
                })
        );

        console.log(`🚀 Starting ingestion of ${chunks.length} chunks...`);

        const vectorStore = this.getStore();

        const batchSize = 100;
        for (let i = 0; i < langChainDocs.length; i += batchSize) {
            const batch = langChainDocs.slice(i, i + batchSize);
            await vectorStore.addDocuments(batch);

            const progress = Math.min(i + batchSize, langChainDocs.length);
            console.log(`📦 Progress: ${progress}/${langChainDocs.length} chunks embedded...`);
        }

        console.log("✅ Ingestion complete!");
        return vectorStore;
    }
}