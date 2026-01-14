import { TextLoader } from './loaders/textLoader';
import { TextChunker } from './utils/chunker';

async function main() {
  console.log('RAG System Starting...\n');

  // Load document
  const loader = new TextLoader();
  const document = await loader.load('./test-data/sample.txt');
  console.log('Document loaded:', document.metadata.source);
  console.log('Document length:', document.content.length, 'characters\n');

  // Chunk document
  const chunker = new TextChunker({ chunkSize: 100, chunkOverlap: 20 });
  const chunks = chunker.chunkDocument(document);
  console.log('Created', chunks.length, 'chunks\n');

  // Display chunks
  chunks.forEach((chunk, i) => {
    console.log(`Chunk ${i}:`, chunk.content.substring(0, 50) + '...');
  });
}

main().catch(console.error);
