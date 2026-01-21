import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Document as LangChainDocument } from "@langchain/core/documents";
import { Document } from "../loaders/textLoader";

export class VectorStoreManager {
    private embeddings: OllamaEmbeddings;
    private collectionName: string;

    constructor(collectionName: string = "rag-collection") {
        // We use Ollama to generate embeddings locally
        this.embeddings = new OllamaEmbeddings({
            model: "llama3", // or whichever model you have pulled in Ollama
            baseUrl: "http://localhost:11434",
        });
        this.collectionName = collectionName;
    }

    async addDocuments(chunks: Document[]) {
        // Map our custom Document format to LangChain's Document format
        const langChainDocs = chunks.map(
            (chunk) =>
                new LangChainDocument({
                    pageContent: chunk.content,
                    metadata: chunk.metadata,
                })
        );

        console.log(`Adding ${chunks.length} chunks to ChromaDB...`);

        // Initialize/Connect to Chroma and add documents
        return await Chroma.fromDocuments(langChainDocs, this.embeddings, {
            collectionName: this.collectionName,
            url: "http://localhost:8000", // Default Chroma port
        });
    }
}