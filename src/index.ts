import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { TextLoader } from './loaders/textLoader';
import { TextChunker } from './utils/chunker';
import { VectorStoreManager } from './vectorstore/chromaStore';
import { setupChain } from './chains/retrievalChain';

async function main() {
  const rl = readline.createInterface({ input, output });

  console.log('--- 🤖 RAG Terminal System ---');

  // 1. Ingestion (In a real app, you might check if the DB already has data)
  const loader = new TextLoader();
  const document = await loader.load('./test-data/sample.txt');
  const chunker = new TextChunker({ chunkSize: 500, chunkOverlap: 50 });
  const chunks = chunker.chunkDocument(document);

  const vectorStoreManager = new VectorStoreManager();
  await vectorStoreManager.addDocuments(chunks);

  // 2. Setup the Chain
  const ragChain = await setupChain();
  let chatHistory: (HumanMessage | AIMessage)[] = [];

  console.log('\nSystem ready. Type your questions (or "exit" to quit).\n');

  // 3. Interactive Loop
  while (true) {
    const userInput = await rl.question('You: ');

    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      console.log('Goodbye!');
      break;
    }

    try {
      const response = await ragChain.invoke({
        input: userInput,
        chat_history: chatHistory,
      });

      console.log(`\nAI: ${response.answer}\n`);

      // Update history for context in the next turn
      chatHistory.push(new HumanMessage(userInput));
      chatHistory.push(new AIMessage(response.answer));

    } catch (error) {
      console.error('Error getting response:', error);
    }
  }

  rl.close();
}

main().catch(console.error);