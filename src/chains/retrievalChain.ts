import { ChatOllama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import 'dotenv/config';

const formatDocuments = (docs: any[]) => {
    return docs.map((doc) => doc.pageContent).join("\n\n");
};

// Use 127.0.0.1 for local Docker stability
const chromaUrl = process.env.CHROMA_URL || "http://127.0.0.1:8000";
const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const COLLECTION_NAME = "traveller_rag";

export const setupChain = async () => {
    // Using ChatOllama for better message handling
    const llm = new ChatOllama({
        model: "gpt-oss:20b",
        temperature: 0,
        baseUrl: ollamaUrl,
    });

    const embeddings = new OllamaEmbeddings({
        model: "qwen3-embedding:0.6b",
        baseUrl: ollamaUrl
    });

    const vectorStore = await Chroma.fromExistingCollection(
        embeddings,
        {
            collectionName: COLLECTION_NAME,
            url: chromaUrl,
        }
    );

    const retriever = vectorStore.asRetriever({ k: 10 });

    const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
        ["system", "Given a chat history and the latest user question, formulate a standalone question which can be understood without the chat history."],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
    ]);

    const qaPrompt = ChatPromptTemplate.fromMessages([
        ["system", `You are an RPG Rulebook Expert. Use the following retrieved context to answer the question. 

    STRICT FORMATTING RULES:
    1. Always use **bold** for key terms, attribute names, and section titles.
    2. Always use *italics* for book quotes or emphasis.
    3. Use bullet points for lists.
    4. If you don't know the answer, say so—do not make up rules.

    Context:
    {context}`],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
    ]);

    const ragChain = RunnableSequence.from([
        RunnablePassthrough.assign({
            context: async (input: any) => {
                let query = input.input;

                // Only contextualize if history exists and query is ambiguous
                const needsContext = input.chat_history.length > 0 &&
                    (query.length < 20 || /it|they|that|those|he|she/i.test(query));

                if (needsContext) {
                    const standaloneChain = contextualizeQPrompt.pipe(llm).pipe(new StringOutputParser());
                    query = await standaloneChain.invoke({
                        ...input,
                        chat_history: input.chat_history.slice(-2)
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
            const response = await qaPrompt.pipe(llm).pipe(new StringOutputParser()).invoke(input);
            return {
                answer: response,
                context: input.rawDocs
            };
        }
    ]);

    return {
        invoke: async (params: { input: string; chat_history: any[] }) => {
            const startTime = Date.now();
            const result = await ragChain.invoke(params);
            const duration = (Date.now() - startTime) / 1000;

            return {
                ...result,
                duration
            };
        }
    };
};