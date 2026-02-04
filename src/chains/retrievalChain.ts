import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import "dotenv/config";

const formatDocuments = (docs: any[]) => {
  return docs.map((doc) => doc.pageContent).join("\n\n");
};

const chromaUrl = process.env.CHROMA_URL;
const ollamaUrl = process.env.OLLAMA_BASE_URL;
const localLLMModel = process.env.LOCAL_LLM_MODEL;
const embeddingModel = process.env.EMBEDDING_MODEL;
const apiBaseURL = process.env.API_BASE_URL;
const apiModel = process.env.API_MODEL;
const apiKey = process.env.API_KEY;
const qa_Prompt = process.env.QA_PPROMPT;

export const setupChain = async (options?: { provider?: "Local" | "API" }) => {
  const provider = options?.provider;

  const llm =
    provider === "Local"
      ? new ChatOllama({
          model: localLLMModel,
          temperature: 0,
          baseUrl: ollamaUrl,
        })
      : new ChatOpenAI({
          model: apiModel,
          configuration: {
            apiKey: apiKey,
            baseURL: apiBaseURL,
          },
        });

  const embeddings = new OllamaEmbeddings({
    model: embeddingModel,
    baseUrl: ollamaUrl,
  });

  const vectorStore = await Chroma.fromExistingCollection(embeddings, {
    url: chromaUrl,
    collectionName: "RAG",
  });

  const retriever = vectorStore.asRetriever({ k: 10 });

  const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "Given a chat history and the latest user question, formulate a standalone question which can be understood without the chat history.",
    ],
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  const qaPrompt = ChatPromptTemplate.fromMessages([
    qa_Prompt,
    new MessagesPlaceholder("chat_history"),
    ["human", "{input}"],
  ]);

  const ragChain = RunnableSequence.from([
    RunnablePassthrough.assign({
      context: async (input: any) => {
        let query = input.input;

        // Only contextualize if history exists and query is ambiguous
        const needsContext =
          input.chat_history.length > 0 &&
          (query.length < 20 || /it|they|that|those|he|she/i.test(query));

        if (needsContext) {
          const standaloneChain = contextualizeQPrompt
            .pipe(llm)
            .pipe(new StringOutputParser());
          query = await standaloneChain.invoke({
            ...input,
            chat_history: input.chat_history.slice(-2),
          });
        }

        const rawDocs = await retriever.invoke(query);
        const formattedContext = formatDocuments(rawDocs);

        return { docs: rawDocs, formatted: formattedContext };
      },
    }),
    {
      context: (previousOutput: any) => previousOutput.context.formatted,
      input: (previousOutput: any) => previousOutput.input,
      chat_history: (previousOutput: any) => previousOutput.chat_history,
      rawDocs: (previousOutput: any) => previousOutput.context.docs,
    },
    async (input: any) => {
      const response = await qaPrompt
        .pipe(llm)
        .pipe(new StringOutputParser())
        .invoke(input);
      return {
        answer: response,
        context: input.rawDocs,
      };
    },
  ]);

  return {
    invoke: async (params: { input: string; chat_history: any[] }) => {
      const startTime = Date.now();
      const result = await ragChain.invoke(params);
      const duration = (Date.now() - startTime) / 1000;

      return {
        ...result,
        duration,
      };
    },
  };
};
