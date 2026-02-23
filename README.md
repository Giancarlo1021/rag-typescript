# RAG TypeScript System

A Retrieval-Augmented Generation (RAG) system built with TypeScript, LangChain.js, Ollama, and ChromaDB.

## Tech Stack

- **LLM**: Ollama (local inference)
- **Framework**: LangChain.js
- **Vector Database**: ChromaDB
- **Runtime**: Node.js with TypeScript

## Future implementations 
- Allow the use of API Key for LLM as an option instead of local
- Introduce INK to simplify terminal creation
  - Including options inthe  terminal for
    - What DB to use
    - Option to rescan DB if new files have been added
- Build GUI
  - Option in the terminal to use the GUI instead of the terminal
    - Should open up to a web interface
   

## Chunking Strategy 
- I drew inspiration for my chunking strategy from this article by nvidia 
  - https://developer.nvidia.com/blog/finding-the-best-chunking-strategy-for-accurate-ai-responses/#:~:text=The%20optimal%20chunking%20strategy%20varies,using%20NVIDIA%20NeMo%20Retriever%20extraction
