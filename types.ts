
export interface CharacterOptions {
  name: string;
  options: string[];
}

export interface StorySegment {
  text: string;
  characters: CharacterOptions[];
  isEnding: boolean;
  title?: string;
  image_description?: string;
  imageBase64?: string;
  theme_color?: string;
}

export type Difficulty = 'easy' | 'normal' | 'hard' | 'extreme';

export interface Checkpoint {
  turn: number;
  history: Array<{
    type: 'narrative' | 'choice';
    content: string;
    image?: string;
  }>;
  characters: CharacterOptions[];
  themeColor: string;
}

export interface StoryState {
  topic: string;
  maxTurns: number;
  characterCount: number;
  currentTurn: number;
  history: Array<{
    type: 'narrative' | 'choice';
    content: string;
    image?: string;
  }>;
  isGameOver: boolean;
  isLoading: boolean;
  error: string | null;
  difficulty: Difficulty;
  checkpoint: Checkpoint | null;
  finalTitle?: string;
}

export enum GameStatus {
  SETUP = 'SETUP',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED'
}
