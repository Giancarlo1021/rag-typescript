import { Ollama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";

// 💡 Helper function to turn database results into a single string for the AI
const formatDocuments = (docs: any[]) => {
    return docs.map((doc) => doc.pageContent).join("\n\n");
};

export const setupChain = async () => {
    const llm = new Ollama({
        model: "gpt-oss:20b",
        temperature: 0,
    });

    const embeddings = new OllamaEmbeddings({
        model: "qwen3-embedding:0.6b"
    });

    // Connect to the Docker Server
    const vectorStore = await Chroma.fromExistingCollection(embeddings, {
        collectionName: "rag-collection",
        url: "http://localhost:8000",
    });

    // 💡 Increase 'k' to 5 to give the AI more context per question
    const retriever = vectorStore.asRetriever({ k: 5 });

    const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
        ["system", "Given a chat history and the latest user question, formulate a standalone question which can be understood without the chat history."],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
    ]);

    const qaPrompt = ChatPromptTemplate.fromMessages([
        ["system", `You are an RPG Rulebook Expert. Use the following retrieved context from the PDF to answer the question. 

    STRICT FORMATING RULES:
    1. Always use **bold** for key terms, attribute names, and section titles.
    2. Always use *italics* for book quotes or emphasis.
    3. Use bullet points for lists.
    4. If you don't know the answer based on the context, say that you don't know—do not make up rules.

    Context:
    {context}`],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
    ]);

    const ragChain = RunnableSequence.from([
        RunnablePassthrough.assign({
            context: async (input: any) => {
                const recentHistory = input.chat_history.slice(-4);
                let query = input.input;

                // Create standalone question if there is history
                if (recentHistory.length > 0) {
                    const standaloneChain = contextualizeQPrompt.pipe(llm).pipe(new StringOutputParser());
                    query = await standaloneChain.invoke({
                        ...input,
                        chat_history: recentHistory
                    });
                }

                // 💡 Fetch the documents
                const docs = await retriever.invoke(query);

                // 💡 Format them into a string so the LLM can actually read them
                return formatDocuments(docs);
            },
        }),
        qaPrompt,
        llm,
        new StringOutputParser(),
    ]);

    return {
        invoke: async (params: { input: string; chat_history: any[] }) => {
            const result = await ragChain.invoke(params);
            return { answer: result };
        }
    };
};