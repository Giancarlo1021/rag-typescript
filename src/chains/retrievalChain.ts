import { Ollama } from "@langchain/ollama";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";

export const setupChain = async () => {
    // 1. Setup the LLM (Ollama)
    const llm = new Ollama({
        model: "llama3",
        temperature: 0,
    });

    // 2. Load the existing Vector Store
    const vectorStore = await Chroma.fromExistingCollection(
        new OllamaEmbeddings({ model: "llama3" }),
        { collectionName: "rag-collection", url: "http://localhost:8000" }
    );

    // 3. Create the Prompt Template
    const systemPrompt = `
    You are an assistant for question-answering tasks. 
    Use the following pieces of retrieved context to answer the question. 
    If you don't know the answer, just say that you don't know. 
    Use three sentences maximum and keep the answer concise.
    \n\n
    Context: {context}
  `;

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["human", "{input}"],
    ]);

    // 4. Create the Chain
    const combineDocsChain = await createStuffDocumentsChain({
        llm,
        prompt,
    });

    return await createRetrievalChain({
        retriever: vectorStore.asRetriever(),
        combineDocsChain,
    });
};