import { GoogleGenAI, Type } from "@google/genai";
import { WordEntry, AppSettings } from '../types';
import { blobToBase64 } from '../utils/audioUtils';
import { LANGUAGES } from '../constants';

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

// Define the response schema for the Gemini model
const wordEntrySchema = {
  type: Type.OBJECT,
  properties: {
    original: { type: Type.STRING, description: "The identified word or phrase in the source language" },
    translation: { type: Type.STRING, description: "The translation in the target language" },
    explanation: { type: Type.STRING, description: "A brief definition or explanation in the target language" },
    synonyms: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "List of synonyms (max 3)"
    },
    examples: {
      type: Type.ARRAY,
      items: { 
        type: Type.OBJECT,
        properties: {
          original: { type: Type.STRING, description: "Sentence in source language" },
          translation: { type: Type.STRING, description: "Sentence translated to target language" }
        },
        required: ["original", "translation"]
      },
      description: "2 sentences showing context usage with translations"
    },
    phonetic: { type: Type.STRING, description: "Phonetic transcription (IPA)" },
  },
  required: ["original", "translation", "explanation", "synonyms", "examples"],
};

const getLangName = (code: string) => {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang ? `${lang.name} (${code})` : code;
};

export const analyzeInput = async (
  input: Blob | string,
  settings: AppSettings
): Promise<WordEntry> => {
  const isAudio = input instanceof Blob;
  
  // Resolve full language names for better context
  const sourceLangName = getLangName(settings.sourceLang);
  const targetLangName = getLangName(settings.targetLang);

  const prompt = `
    STRICT LANGUAGE CONFIGURATION:
    - Input Source Language: ${sourceLangName}
    - Output Target Language: ${targetLangName}
    
    SYSTEM INSTRUCTIONS:
    ${settings.systemPrompt}
    
    IMPORTANT: 
    1. The 'explanation' field MUST be written in ${targetLangName}.
    2. Provide 2 distinct example sentences using the word in ${sourceLangName} AND provide their translation in ${targetLangName}.
  `;

  let contentPart: any;

  if (isAudio) {
    const base64Audio = await blobToBase64(input as Blob);
    contentPart = {
      inlineData: {
        mimeType: (input as Blob).type || 'audio/webm',
        data: base64Audio,
      },
    };
  } else {
    contentPart = {
      text: input as string,
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          contentPart,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: wordEntrySchema,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const data = JSON.parse(text);

    return {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...data
    };

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};