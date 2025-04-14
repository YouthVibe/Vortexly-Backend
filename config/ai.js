const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const initAI = () => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  console.log('AI service initialized');
  return genAI;
};

module.exports = { initAI }; 