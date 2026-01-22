import * as readline from 'node:readline/promises';
import * as fs from 'fs/promises';
import { stdin as input, stdout as output } from 'node:process';
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { TextChunker } from './utils/chunker.js';
import { VectorStoreManager } from './vectorstore/chromaStore.js';
import { setupChain } from './chains/retrievalChain.js';
import { PdfLoader } from "./loaders/pdfLoader.js";
import path from "path";
import { Chalk } from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import boxen from 'boxen';
import { renderMarkdown } from './utils/markdownRenderer.ts';

const ctx = new Chalk({ level: 3 });

/**
 * 📦 Wrap AI response in a beautiful panel
 */
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

/**
 * 📦 Create info panel for system messages
 */
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
  const vectorStoreManager = new VectorStoreManager();
  const docsDir = path.resolve('./docs');
  const pdfLoader = new PdfLoader();

  // Show a nice welcome banner
  console.log(boxen(
    ctx.bold.magentaBright('🚀 RAG System Terminal\n') +
    ctx.gray('Powered by LangChain & ChromaDB'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'magenta',
      textAlignment: 'center',
    }
  ));

  // Initial check for existing data with spinner
  const checkSpinner = ora({
    text: 'Checking database...',
    color: 'cyan',
  }).start();

  let count = await vectorStoreManager.getCount();
  checkSpinner.succeed(ctx.green(`Database contains ${count} chunks`));

  if (count > 0) {
    console.log(createInfoPanel(
      `📡 Database already initialized with ${ctx.bold(count.toString())} chunks.\n` +
      `${ctx.gray('Skipping document ingestion.')}`,
      '✅ Ready'
    ));
  } else {
    try {
      console.log(ctx.bold.yellow('\n📚 Starting Document Ingestion...\n'));

      const files = await fs.readdir(docsDir);
      const pdfFiles = files.filter(file =>
        !file.startsWith('.') &&
        !file.includes('.identifier') &&
        path.extname(file).toLowerCase() === '.pdf'
      );

      if (pdfFiles.length === 0) {
        console.log(createInfoPanel(
          '⚠️ No PDF files found in ./docs directory',
          '⚠️ Warning'
        ));
      } else {
        // Create progress bar for file processing
        const progressBar = new cliProgress.SingleBar({
          format: ctx.cyan('Progress |') + '{bar}' + ctx.cyan('| {percentage}% | {value}/{total} files | {filename}'),
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          hideCursor: true
        }, cliProgress.Presets.shades_classic);

        progressBar.start(pdfFiles.length, 0, { filename: 'Starting...' });

        for (let i = 0; i < pdfFiles.length; i++) {
          const file = pdfFiles[i];
          const filePath = path.join(docsDir, file);

          progressBar.update(i, { filename: file });

          const loadedResult = await pdfLoader.load(filePath);
          const documents = Array.isArray(loadedResult) ? loadedResult : [loadedResult];
          const chunker = new TextChunker({ chunkSize: 1500, chunkOverlap: 150 });

          for (const doc of documents) {
            const chunks = chunker.chunkDocument(doc);
            await vectorStoreManager.addDocuments(chunks);
          }
        }

        progressBar.update(pdfFiles.length, { filename: 'Complete!' });
        progressBar.stop();

        // Verification check
        const newCount = await vectorStoreManager.getCount();
        if (newCount === 0) {
          console.log(createInfoPanel(
            '⚠️ Ingestion finished but database count is still 0.\n' +
            ctx.gray('Check ChromaDB persistence configuration!'),
            '⚠️ Warning'
          ));
        } else {
          console.log(createInfoPanel(
            `✅ Successfully ingested ${ctx.bold(pdfFiles.length.toString())} PDF files\n` +
            `📊 Total chunks in database: ${ctx.bold.green(newCount.toString())}`,
            '✅ Ingestion Complete'
          ));
        }
      }
    } catch (err: any) {
      console.error(boxen(
        `❌ Ingestion Error:\n${ctx.red(err.message)}`,
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'red',
          title: '❌ Error',
        }
      ));
    }
  }

  // Initialize RAG chain with spinner
  const setupSpinner = ora({
    text: 'Setting up RAG chain...',
    color: 'magenta',
  }).start();

  const ragChain = await setupChain();
  let chatHistory: (HumanMessage | AIMessage)[] = [];

  setupSpinner.succeed(ctx.green('RAG chain ready!'));

  console.log(createInfoPanel(
    `💬 Start asking questions about your documents\n` +
    ctx.gray('Type "exit" or "quit" to end the session'),
    '🎯 Ready to Chat'
  ));

  while (true) {
    const userInput = await rl.question(ctx.bold.blue('\n❯ You: '));

    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      console.log(boxen(
        ctx.magentaBright('👋 Thank you for using RAG Terminal!\n') +
        ctx.gray('Session ended.'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'magenta',
          textAlignment: 'center',
        }
      ));
      break;
    }

    if (!userInput.trim()) {
      continue;
    }

    // Show spinner while getting response
    const responseSpinner = ora({
      text: 'Thinking...',
      color: 'magenta',
      spinner: 'dots12',
    }).start();

    try {
      const response = await ragChain.invoke({
        input: userInput,
        chat_history: chatHistory,
      });

      responseSpinner.stop();

      // Render markdown and wrap in panel
      const rendered = renderMarkdown(response.answer);
      const panel = createResponsePanel(rendered);

      console.log(panel);

      chatHistory.push(new HumanMessage(userInput));
      chatHistory.push(new AIMessage(response.answer));

      // Keep only last 10 messages
      if (chatHistory.length > 10) {
        chatHistory = chatHistory.slice(-10);
      }
    } catch (error: any) {
      responseSpinner.stop();
      console.error(boxen(
        `❌ Error: ${error.message || 'Unknown error occurred'}`,
        {
          padding: 1,
          borderStyle: 'round',
          borderColor: 'red',
          title: '❌ Error',
        }
      ));
    }
  }
  rl.close();
}

main().catch(console.error);
