import { TextLoader } from './loaders/textLoader';
import { TextChunker } from './utils/chunker';
import { VectorStoreManager } from './vectorstore/chromaStore';
import { setupChain } from './chains/retrievalChain';

async function main() {
  // ... (previous ingestion code here) ...
  const vectorStoreManager = new VectorStoreManager();
  await vectorStoreManager.addDocuments(chunks);

  console.log('--- Starting Retrieval ---\n');

  const ragChain = await setupChain();
  const question = "What is the main topic of the document?"; // Adjust based on your sample.txt

  const response = await ragChain.invoke({
    input: question,
  });

  console.log("Question:", question);
  console.log("Answer:", response.answer);
}

main().catch(console.error);