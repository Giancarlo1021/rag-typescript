import { Ollama, OllamaEmbeddings } from "@langchain/ollama";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createHistoryAwareRetriever } from "langchain/chains/history_aware_retriever";
import { Chroma } from "@langchain/community/vectorstores/chroma";

export const setupChain = async () => {
    const llm = new Ollama({
        model: "llama3",
        temperature: 0,
    });

    const vectorStore = await Chroma.fromExistingCollection(
        new OllamaEmbeddings({ model: "llama3" }),
        { collectionName: "rag-collection", url: "http://localhost:8000" }
    );

    const retriever = vectorStore.asRetriever();

    // 1. Define the logic to "re-phrase" the question with history
    const contextualizeQSystemPrompt = `
    Given a chat history and the latest user question 
    which might reference context in the chat history, 
    formulate a standalone question which can be understood 
    without the chat history. Do NOT answer the question, 
    just reformulate it if needed and otherwise return it as is.`;

    const contextualizeQPrompt = ChatPromptTemplate.fromMessages([
        ["system", contextualizeQSystemPrompt],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
    ]);

    const historyAwareRetriever = await createHistoryAwareRetriever({
        llm,
        retriever,
        rephrasePrompt: contextualizeQPrompt,
    });

    // 2. Define the prompt for the actual answer
    const systemPrompt = `
    You are an assistant for question-answering tasks. 
    Use the following pieces of retrieved context to answer the question. 
    Context: {context}`;

    const qaPrompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        new MessagesPlaceholder("chat_history"),
        ["human", "{input}"],
    ]);

    const combineDocsChain = await createStuffDocumentsChain({
        llm,
        prompt: qaPrompt,
    });

    return await createRetrievalChain({
        retriever: historyAwareRetriever,
        combineDocsChain,
    });
};