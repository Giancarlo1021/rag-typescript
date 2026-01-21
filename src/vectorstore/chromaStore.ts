import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Document as LangChainDocument } from "@langchain/core/documents";
import { Document } from "../loaders/textLoader.js";
import { ChromaClient } from "chromadb";

export class VectorStoreManager {
    private embeddings: OllamaEmbeddings;
    private collectionName: string;

    constructor(collectionName: string = "rag-collection") {
        this.embeddings = new OllamaEmbeddings({
            model: "qwen3-embedding:0.6b",
            baseUrl: "http://localhost:11434",
        });
        this.collectionName = collectionName;
    }

    async getCount(): Promise<number> {
        try {
            // We use the LangChain wrapper instead of the raw ChromaClient
            const vectorStore = new Chroma(this.embeddings, {
                collectionName: this.collectionName,
                url: "http://localhost:8000",
            });

            // The LangChain wrapper gives us access to the underlying collection
            const collection = await vectorStore.ensureCollection();
            return await collection.count();
        } catch (error) {
            console.log("No existing collection found.");
            return 0;
        }
    }

    async addDocuments(chunks: Document[]) {
        const langChainDocs = chunks.map(
            (chunk) =>
                new LangChainDocument({
                    pageContent: chunk.content,
                    metadata: chunk.metadata,
                })
        );

        console.log(`🚀 Starting ingestion of ${chunks.length} chunks...`);

        // 1. Initialize the store connection first
        const vectorStore = new Chroma(this.embeddings, {
            collectionName: this.collectionName,
            url: "http://localhost:8000",
        });

        // 2. 💡 THE FIX: Loop through chunks in batches of 100
        const batchSize = 100;
        for (let i = 0; i < langChainDocs.length; i += batchSize) {
            const batch = langChainDocs.slice(i, i + batchSize);

            // Add this specific batch to the DB
            await vectorStore.addDocuments(batch);

            const progress = Math.min(i + batchSize, langChainDocs.length);
            console.log(`📦 Progress: ${progress}/${langChainDocs.length} chunks embedded...`);
        }

        console.log("✅ Ingestion complete!");
        return vectorStore;
    }
}