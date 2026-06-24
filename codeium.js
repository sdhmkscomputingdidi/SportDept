import { ChatOpenAI } from 'langchain/chains';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

const chat = new ChatOpenAI({
  openAI: {
    modelName: 'gpt-3.5-turbo', // You can change the model name here
    temperature: 0.7, // You can adjust the temperature here
    maxTokens: 1024, // You can adjust the maximum number of tokens here
  },
  embeddings: new OpenAIEmbeddings({ openAI: { modelName: 'text-embedding-ada-002' } }),
  memory: {
    storage: new Map(),
    keyPrefix: 'chat',
  },
  textSplitter: new RecursiveCharacterTextSplitter({ chunkSize: 1000 }),
});

// You can now use the chat object to interact with the model
// For example, you can ask questions or provide context to the model
// and receive responses

// Example usage:
const prompt = 'What is the capital of France?';
chat.call({ input: prompt }).then((response) => {
  console.log(response);
});