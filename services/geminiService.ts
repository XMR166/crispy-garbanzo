
import { GoogleGenAI, Type, Schema, Chat } from "@google/genai";
import { StorySegment, Difficulty } from "../types";

// Initialize the client with the API key from environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the expected JSON schema for the model's response
const storySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A short, evocative title for the current scene or the story.",
    },
    text: {
      type: Type.STRING,
      description: "The narrative content of the story segment. Be descriptive and engaging. Write in Spanish.",
    },
    image_description: {
      type: Type.STRING,
      description: "A detailed visual description of the current scene in English, suitable for an image generator. Include details about lighting, style, environment, and characters.",
    },
    theme_color: {
      type: Type.STRING,
      description: "A Tailwind CSS color name representing the scene's mood. Valid values: 'slate', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'. Default 'indigo'.",
    },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of the character" },
          options: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of 2-4 distinct actions for this specific character."
          }
        },
        required: ["name", "options"]
      },
      description: "A list of playable characters and their available decisions for this turn. If isEnding is true, options should be empty.",
    },
    isEnding: {
      type: Type.BOOLEAN,
      description: "True if the story has reached a conclusion, False otherwise.",
    },
  },
  required: ["text", "characters", "isEnding", "image_description"],
};

let chatSession: Chat | null = null;

const generateSceneImage = async (prompt: string): Promise<string | undefined> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }
  } catch (error) {
    console.warn("Failed to generate image:", error);
    // Do not throw, just return undefined so the story can continue without an image
    return undefined;
  }
  return undefined;
};

const getDifficultyInstruction = (difficulty: Difficulty): string => {
  switch (difficulty) {
    case 'easy':
      return "Dificultad FÁCIL: Los protagonistas tienen mucha suerte. Es difícil morir o fracasar.";
    case 'normal':
      return "Dificultad NORMAL: Reto equilibrado. Las malas decisiones tienen consecuencias.";
    case 'hard':
      return "Dificultad DIFÍCIL: Realista y crudo. Las decisiones imprudentes llevan a la muerte.";
    case 'extreme':
      return "Dificultad EXTREMA: Estilo 'Dark Souls' o Lovecraft. Supervivencia improbable. El menor error es fatal.";
    default:
      return "Dificultad NORMAL.";
  }
};

export const initStory = async (topic: string, totalTurns: number, difficulty: Difficulty, characterCount: number): Promise<StorySegment> => {
  const difficultyPrompt = getDifficultyInstruction(difficulty);

  // Create a new chat session for a fresh story
  chatSession = ai.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: `
        Eres un narrador de historias interactivas experto (Dungeon Master). 
        
        Configuración de la Partida:
        - Idioma: ESPAÑOL.
        - Personajes Jugables: ${characterCount}.
        - Dificultad: ${difficultyPrompt}
        
        Reglas:
        1. La historia avanza por turnos.
        2. Longitud MÁXIMA: ${totalTurns} turnos. Puedes terminar antes si la trama lo requiere.
        3. Si se alcanza el límite, fuerza un final.
        4. Genera opciones INDEPENDIENTES para CADA uno de los ${characterCount} personajes.
        5. Sé creativo y descriptivo.
        6. Genera siempre un 'image_description' en INGLÉS detallado.
        7. Elige un 'theme_color' (Tailwind color) adecuado.
      `,
      responseMimeType: "application/json",
      responseSchema: storySchema,
    },
  });

  const prompt = `
    Tema: "${topic}".
    Personajes: ${characterCount}.
    Máximo Turnos: ${totalTurns}.
    
    INICIO: Presenta a los ${characterCount} personajes, el mundo y el conflicto inicial.
    Define nombres para los personajes si el usuario no los dio.
    Ofrece opciones para cada personaje.
  `;

  try {
    const response = await chatSession.sendMessage({ message: prompt });
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const segment = JSON.parse(text) as StorySegment;
    
    if (segment.image_description) {
      segment.imageBase64 = await generateSceneImage(segment.image_description);
    }
    
    return segment;
  } catch (error) {
    console.error("Error starting story:", error);
    throw error;
  }
};

export const nextTurn = async (choicesPrompt: string, currentTurn: number, maxTurns: number): Promise<StorySegment> => {
  if (!chatSession) {
    throw new Error("Chat session not initialized");
  }

  const isFinalTurn = currentTurn >= maxTurns;
  
  let prompt = `Decisiones del usuario:\n${choicesPrompt}`;
  
  if (isFinalTurn) {
    prompt += `
      Turno final (${currentTurn}/${maxTurns}).
      Escribe el FINAL definitivo.
      isEnding: true.
      characters: [].
      title: "Genera aquí un TÍTULO ÉPICO y conclusivo para toda la historia".
    `;
  } else {
    prompt += `
      Turno ${currentTurn}/${maxTurns}.
      Continúa la narración considerando las acciones de TODOS los personajes.
      Si lleva a un final, isEnding: true y genera un TÍTULO para la historia en el campo 'title'.
      Si no, ofrece nuevas opciones para cada personaje vivo.
    `;
  }

  try {
    const response = await chatSession.sendMessage({ message: prompt });
    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const segment = JSON.parse(text) as StorySegment;

    if (segment.image_description) {
      segment.imageBase64 = await generateSceneImage(segment.image_description);
    }

    return segment;
  } catch (error) {
    console.error("Error advancing story:", error);
    throw error;
  }
};
