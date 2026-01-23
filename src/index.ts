import * as readline from 'node:readline/promises';
import * as fs from 'fs/promises';
import { stdin as input, stdout as output } from 'node:process';
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { TextChunker } from './utils/chunker.js';
import { VectorStoreManager } from './vectorstore/chromaStore.js';
import { setupChain } from './chains/retrievalChain.js';
import { PdfLoader } from "./loaders/pdfLoader.js";
import { EpubLoader } from "./loaders/epubLoader.js";
import path from "path";
import { Chalk } from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import boxen from 'boxen';
import { renderMarkdown } from './utils/markdownRenderer.js';
import 'dotenv/config';

// --- CONFIGURATION ---
const chromaUrl = process.env.CHROMA_URL || `http://localhost:8000`;
const ctx = new Chalk({ level: 3 });

// --- UI COMPONENTS ---
function createResponsePanel(content: string): string {
  return boxen(content, {
    padding: 1,
    margin: { top: 0, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: 'magenta',
    title: '🤖 Assistant',
    titleAlignment: 'left',
  });
}

function createInfoPanel(content: string, title: string = 'ℹ️ Info'): string {
  return boxen(content, {
    padding: 1,
    margin: { top: 0, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: 'cyan',
    title,
    titleAlignment: 'left',
  });
}

async function main() {
  const rl = readline.createInterface({ input, output });

  // Initialize Managers
  const vectorStoreManager = new VectorStoreManager(chromaUrl);
  const textChunker = new TextChunker({ chunkSize: 800, chunkOverlap: 100 });
  const docsDir = path.resolve('./docs');

  console.log(boxen(
    ctx.bold.magentaBright('🚀 RAG System Terminal\n') +
    ctx.gray('Powered by LangChain & ChromaDB'),
    { padding: 1, margin: 1, borderStyle: 'double', borderColor: 'magenta', textAlignment: 'center' }
  ));

  const checkSpinner = ora({ text: 'Checking database...', color: 'cyan' }).start();
  let count = await vectorStoreManager.getCount();
  checkSpinner.succeed(ctx.green(`Database contains ${count} chunks`));

  // --- START INGESTION LOGIC ---
  try {
    const allFiles = await fs.readdir(docsDir);
    const validFiles = allFiles.filter(file =>
      !file.startsWith('.') &&
      !file.includes(':Zone.Identifier') && // Skip those Windows metadata files
      ['.pdf', '.epub', '.txt'].includes(path.extname(file).toLowerCase())
    );

    if (validFiles.length > 0) {
      console.log(ctx.bold.yellow('\n📚 Checking for new documents...\n'));

      const progressBar = new cliProgress.SingleBar({
        format: ctx.cyan('Progress |') + '{bar}' + ctx.cyan('| {percentage}% | {value}/{total} files | {filename}'),
        barCompleteChar: '\u2588', barIncompleteChar: '\u2591', hideCursor: true
      }, cliProgress.Presets.shades_classic);

      progressBar.start(validFiles.length, 0, { filename: 'Starting...' });

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const filePath = path.join(docsDir, file);
        const extension = path.extname(file).toLowerCase();

        // 🔍 Smart Check: Skip if already ingested
        // We use basename to match the 'source' metadata format in PdfLoader
        const existing = await vectorStoreManager.searchMetadata({ source: file });
        if (existing.length > 0) {
          progressBar.increment(1, { filename: `Skipped: ${file}` });
          continue;
        }

        progressBar.update(i, { filename: file });

        try {
          let doc = null;

          if (extension === '.pdf') {
            const loader = new PdfLoader();
            doc = await loader.load(filePath);
          } else if (extension === '.epub') {
            const loader = new EpubLoader();
            doc = await loader.load(filePath);
          }

          // If loader failed or returned null, skip it
          if (!doc || !doc.content) {
            continue;
          }

          // Process valid document
          const chunks = await textChunker.chunkDocument(doc);
          await vectorStoreManager.addDocuments(chunks);

          progressBar.increment(1, { filename: `Ingested: ${file}` });

        } catch (error) {
          // Individual file error - log and move on to next file
          console.log(ctx.red(`\n❌ Error processing ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`));
          progressBar.increment(1, { filename: `Failed: ${file}` });
          continue;
        }
      }
      progressBar.stop();
    }
  } catch (err: any) {
    console.error(ctx.red(`Critical Ingestion Error: ${err.message}`));
  }

  // --- START CHAT LOGIC ---
  const setupSpinner = ora({ text: 'Setting up RAG chain...', color: 'magenta' }).start();
  const ragChain = await setupChain();
  let chatHistory: (HumanMessage | AIMessage)[] = [];
  setupSpinner.succeed(ctx.green('RAG chain ready!'));

  console.log(createInfoPanel(`💬 Ask about your documents\n` + ctx.gray('Type "exit" to quit'), '🎯 Ready'));

  while (true) {
    const userInput = await rl.question(ctx.bold.blue('\n❯ You: '));
    if (['exit', 'quit'].includes(userInput.toLowerCase())) break;
    if (!userInput.trim()) continue;

    const responseSpinner = ora({ text: 'Thinking...', color: 'green', spinner: 'point' }).start();

    try {
      const response = await ragChain.invoke({
        input: userInput,
        chat_history: chatHistory
      });

      responseSpinner.stop();

      console.log(createResponsePanel(renderMarkdown(response.answer)));

      if (response.context && response.context.length > 0) {
        const uniqueSources = [...new Set(response.context.map((d: any) => d.metadata.source))];
        const sourceText = uniqueSources
          .map(s => ctx.cyan(' • ') + ctx.gray(s))
          .join('\n');

        const statsLine = ctx.yellow(`\n\n⏱️  Thinking time: ${response.duration.toFixed(2)}s`);

        console.log(boxen(sourceText + statsLine, {
          title: '📚 Sources & Performance',
          titleAlignment: 'left',
          padding: { left: 1, right: 1, top: 0, bottom: 0 },
          margin: { top: 0, bottom: 1, left: 0, right: 0 },
          borderStyle: 'classic',
          borderColor: 'cyan',
        }));
      }

      chatHistory.push(new HumanMessage(userInput), new AIMessage(response.answer));
      if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

    } catch (error: any) {
      responseSpinner.stop();
      console.error(ctx.red(`❌ Error: ${error.message}`));
    }
  }
  rl.close();
}

main().catch(console.error);