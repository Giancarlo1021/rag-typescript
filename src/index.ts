import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { setupChain } from "./chains/retrievalChain";
// ... (other imports)

async function main() {
  // ... (keep ingestion logic) ...

  const ragChain = await setupChain();

  // We maintain an array of messages to act as history
  let chatHistory: any[] = [];

  // Round 1
  const q1 = "What is this document about?";
  const res1 = await ragChain.invoke({ input: q1, chat_history: chatHistory });
  console.log(`User: ${q1}\nAI: ${res1.answer}\n`);

  // Update history
  chatHistory.push(new HumanMessage(q1), new AIMessage(res1.answer));

  // Round 2 (Contextual question)
  const q2 = "Can you give me more details about it?";
  const res2 = await ragChain.invoke({ input: q2, chat_history: chatHistory });
  console.log(`User: ${q2}\nAI: ${res2.answer}`);
}