import { TextLoader } from './loaders/textLoader';
import { TextChunker } from './utils/chunker';
import { VectorStoreManager } from './vectorstore/chromaStore';

async function main() {
  console.log('--- RAG System: Vector Storage Phase ---\n');

  // 1. Load document
  const loader = new TextLoader();
  const document = await loader.load('./test-data/sample.txt');

  // 2. Chunk document
  const chunker = new TextChunker({ chunkSize: 200, chunkOverlap: 50 });
  const chunks = chunker.chunkDocument(document);
  console.log(`✓ Created ${chunks.length} chunks.`);

  // 3. Initialize Vector Store and Add Chunks
  const vectorStoreManager = new VectorStoreManager();
  await vectorStoreManager.addDocuments(chunks);

  console.log('\n✓ Vector store populated successfully.');
}

main().catch((err) => {
  console.error("Error during execution:", err);
});