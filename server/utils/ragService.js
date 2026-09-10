const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { PineconeStore, PineconeEmbeddings } = require("@langchain/pinecone"); // Switched from local to hosted
const { Pinecone: PineconeClient } = require("@pinecone-database/pinecone");
const { ChatGroq } = require("@langchain/groq");
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { createStuffDocumentsChain } = require("@langchain/classic/chains/combine_documents");
const { createRetrievalChain } = require("@langchain/classic/chains/retrieval");
const { createHistoryAwareRetriever } = require("@langchain/classic/chains/history_aware_retriever");
const ChatSession = require('../models/ChatSession');
const { HumanMessage, AIMessage } = require("@langchain/core/messages");
const path = require('path');
const fs = require('fs');

class RagService {
  constructor() {
    console.log("Initializing RagService with Pinecone Hosted Inference...");
    
    // Hosted Pinecone Inference
    this.embeddings = new PineconeEmbeddings({
      model: "llama-text-embed-v2", // Matches the selected model in your screenshot
      apiKey: process.env.PINECONE_API_KEY,
    });

    this.llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.1-8b-instant",
    });

    this.vectorStore = null;
    this.pc = new PineconeClient({
      apiKey: process.env.PINECONE_API_KEY,
    });
    this.indexName = process.env.PINECONE_INDEX_NAME || "ride-dosthi-knowledge";
  }

  async initVectorStore() {
    if (!this.vectorStore) {
      if (!process.env.PINECONE_API_KEY) {
        throw new Error("PINECONE_API_KEY is not defined in environment variables.");
      }
      
      const pineconeIndex = this.pc.Index(this.indexName);
      
      this.vectorStore = await PineconeStore.fromExistingIndex(
        this.embeddings,
        {
          pineconeIndex,
          maxConcurrency: 5,
        }
      );
    }
    return this.vectorStore;
  }

  /**
   * Ingests all PDFs from the specified directory into Pinecone.
   */
  async ingestAllPdfs(directoryPath = "../../") {
    const docsDir = path.resolve(__dirname, directoryPath);
    console.log(`Scanning directory for PDFs: ${docsDir}...`);

    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.pdf'));
    console.log(`Found ${files.length} PDF files.`);

    const allDocs = [];
    for (const file of files) {
      const filePath = path.join(docsDir, file);
      const loader = new PDFLoader(filePath);
      const docs = await loader.load();
      
      const enrichedDocs = docs.map(doc => {
        const filename = path.basename(filePath);
        const category = this.determineCategory(filename);
        return {
          ...doc,
          metadata: {
            ...doc.metadata,
            source: filename,
            category: category,
            ingested_at: new Date().toISOString()
          }
        };
      });
      allDocs.push(...enrichedDocs);
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const splitDocs = await textSplitter.splitDocuments(allDocs);
    console.log(`Uploading ${splitDocs.length} chunks to Pinecone Index: ${this.indexName}...`);

    const pineconeIndex = this.pc.Index(this.indexName);
    
    this.vectorStore = await PineconeStore.fromDocuments(
      splitDocs,
      this.embeddings,
      {
        pineconeIndex,
        maxConcurrency: 5,
      }
    );

    return true;
  }

  determineCategory(filename) {
    if (filename.includes('Passenger')) return 'passenger';
    if (filename.includes('Rider')) return 'rider';
    if (filename.includes('Payment') || filename.includes('Wallet')) return 'financial';
    if (filename.includes('Safety')) return 'safety';
    if (filename.includes('Troubleshooting')) return 'support';
    if (filename.includes('Terms') || filename.includes('Policies')) return 'legal';
    return 'general';
  }

  async routeQuestion(question) {
    const routingPrompt = `Determine which category describes the user's question.
      Available Categories:
      - passenger, rider, financial, safety, support, legal, general.
      
      User Question: "${question}"
      Respond ONLY with the category name.`;

    const response = await this.llm.invoke(routingPrompt);
    const category = response.content.trim().toLowerCase();
    
    const allowedCategories = ['passenger', 'rider', 'financial', 'safety', 'support', 'legal'];
    return allowedCategories.includes(category) ? category : null;
  }

  async getChatHistory(threadId) {
    let session = await ChatSession.findOne({ threadId });
    if (!session) {
      session = await ChatSession.create({ threadId, messages: [] });
    }
    return session.messages.map(msg => {
      if (msg.role === 'user') return new HumanMessage(msg.content);
      if (msg.role === 'assistant') return new AIMessage(msg.content);
      return null;
    }).filter(m => m !== null);
  }

  async saveMessage(threadId, role, content) {
    await ChatSession.findOneAndUpdate(
      { threadId },
      { $push: { messages: { role, content } } },
      { upsert: true, new: true }
    );
  }

  async ask(question, threadId) {
    await this.initVectorStore();
    const history = await this.getChatHistory(threadId);

    // REMOVED BRITTLE FILTERING: Global search is better for small knowledge bases
    const filter = null; 
    console.log(`Searching all documents for: "${question}"`);

    // Ensure API Key is in environment for buggy SDK check
    process.env.PINECONE_API_KEY = process.env.PINECONE_API_KEY || this.pc.apiKey;

    console.log(`Asking question: "${question}" with filter:`, filter);

    let finalQuery = question;
    if (history.length > 0) {
      const rephrasePrompt = `Given the chat history and follow-up question, rephrase it to be standalone. 
      Respond ONLY with the question.
      History: ${JSON.stringify(history.slice(-4))}
      Question: ${question}`;
      
      const rephraseRes = await this.llm.invoke(rephrasePrompt);
      finalQuery = rephraseRes.content.trim() || question;
      console.log(`Rephrased query: "${finalQuery}"`);
    }

    const retriever = this.vectorStore.asRetriever({
      filter: filter,
      k: 6
    });

    const context = await retriever.invoke(finalQuery);
    
    const systemPrompt = `You are RideDosthi AI, the official mission-control support for the platform. 
    Your goal is to provide precise, helpful, and professional assistance using ONLY the provided context.
    
    CRITICAL ROLES:
    - PASSENGER: The user who searches for and BOOKS a ride.
    - RIDER: The user who OFFERS/Drives a ride (Driver).
    
    If the context doesn't contain the answer, say "I don't have that specific information in my current training documents, please check our help center." 
    NEVER hallucinate or suggest steps from generic ride-sharing apps.
    
    Context: {context}`;
    const qaPrompt = ChatPromptTemplate.fromMessages([
      ["system", systemPrompt],
      new MessagesPlaceholder("chat_history"),
      ["human", "{input}"],
    ]);

    const combineDocsChain = await createStuffDocumentsChain({
      llm: this.llm,
      prompt: qaPrompt,
    });

    const response = await combineDocsChain.invoke({
      context,
      chat_history: history,
      input: question,
    });

    console.log("RAG Response successful.");
    
    await this.saveMessage(threadId, 'user', question);
    await this.saveMessage(threadId, 'assistant', String(response));
    return String(response);
  }
}

module.exports = new RagService();



