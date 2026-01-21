import * as readline from 'node:readline/promises';
import * as fs from 'fs/promises';
import { stdin as input, stdout as output } from 'node:process';
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { TextChunker } from './utils/chunker.js';
import { VectorStoreManager } from './vectorstore/chromaStore.js';
import { setupChain } from './chains/retrievalChain.js';
import { TextLoader } from "./loaders/textLoader.js";
import { PdfLoader } from "./loaders/pdfLoader.js";
import path from "path";
import { Chalk } from 'chalk';

const ctx = new Chalk({ level: 3 });

export async function loadFile(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".pdf") {
    return await new PdfLoader().load(filePath);
  } else if (extension === ".txt" || extension === ".md") {
    return await new TextLoader().load(filePath);
  } else {
    throw new Error(`Unsupported file type: ${extension}`);
  }
}

/**
 * 💡 THE REGEX RENDERER
 * Swaps Markdown symbols for Chalk colors directly.
 */
function renderMarkdown(text: string): string {
  return text
    .split('\n')
    .map(line => {
      let l = line.trimStart();

      // 1. Color bullet points Yellow
      l = l.replace(/^[*|-]\s+/, ctx.yellow('• '));

      // 2. Bold (**text**) -> Bright Green
      l = l.replace(/\*\*(.*?)\*\*/g, ctx.bold.greenBright('$1'));

      // 3. Italics (*text*) -> Cyan
      l = l.replace(/\*(.*?)\*/g, ctx.cyan('$1'));

      // 4. Inline Code (`text`) -> Gray Background
      l = l.replace(/`(.*?)`/g, ctx.bgGray.white(' $1 '));

      return l;
    })
    .join('\n');
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const vectorStoreManager = new VectorStoreManager();
  const count = await vectorStoreManager.getCount();
  const docsDir = path.resolve('./docs');

  if (count > 0) {
    console.log(ctx.bold.magenta('\n=== STARS WITHOUT NUMBER AI ASSISTANT ===\n'));
    console.log(`📡 Database already has ${count} chunks. Skipping ingestion.`);
  } else {
    try {
      console.log('--- 🤖 Starting First-Time Ingestion ---');
      const files = await fs.readdir(docsDir);
      for (const file of files) {
        if (file.startsWith('.') || file.endsWith('.identifier')) continue;
        const filePath = path.join(docsDir, file);
        const loadedResult = await loadFile(filePath);
        const documents = Array.isArray(loadedResult) ? loadedResult : [loadedResult];
        const chunker = new TextChunker({ chunkSize: 500, chunkOverlap: 50 });
        for (const doc of documents) {
          const chunks = chunker.chunkDocument(doc);
          await vectorStoreManager.addDocuments(chunks);
        }
      }
      console.log('✅ Ingestion complete!');
    } catch (err: any) {
      console.error(`❌ Error: ${err.message}`);
    }
  }

  const ragChain = await setupChain();
  let chatHistory: (HumanMessage | AIMessage)[] = [];

  console.log('\nSystem ready. Type your questions (or "exit" to quit).\n');

  while (true) {
    const userInput = await rl.question(ctx.bold.blue('You: '));

    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      console.log('Goodbye!');
      break;
    }

    try {
      const response = await ragChain.invoke({
        input: userInput,
        chat_history: chatHistory,
      });

      // 💡 Use our new Regex Renderer
      const formatted = renderMarkdown(response.answer);

      console.log(ctx.bold.magenta('\nAI: ') + formatted + '\n');

      chatHistory.push(new HumanMessage(userInput));
      chatHistory.push(new AIMessage(response.answer));

      if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);
    } catch (error) {
      console.error('Error getting response:', error);
    }
  }
  rl.close();
}

main().catch(console.error);