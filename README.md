# RAG TypeScript System

A Retrieval-Augmented Generation (RAG) system built with TypeScript, LangChain.js, Ollama, and ChromaDB.

## Tech Stack

- **LLM**: Ollama (local inference)
- **Framework**: LangChain.js
- **Vector Database**: ChromaDB
- **Runtime**: Node.js with TypeScript

## Setup

1. Install dependencies:
```bash
   npm install --legacy-peer-deps
```

2. Copy environment variables:
```bash
   cp .env.example .env
```

3. Make sure Ollama is running locally

4. Run development server:
```bash
   npm run dev
```

## Project Structure
```
src/
├── loaders/       # Document loaders
├── vectorstore/   # Vector database logic
├── chains/        # LangChain chains
├── utils/         # Utility functions
├── config/        # Configuration
└── index.ts       # Entry point
