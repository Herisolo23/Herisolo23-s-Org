
export interface Source {
  id: string;
  title: string;
  description: string;
  content: string;
  type: 'text' | 'url' | 'file' | 'image' | 'video';
  dateAdded: number;
  mimeType?: string;
}

export interface Folder {
  id: string;
  name: string;
  dateCreated: number;
  color?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  dateCreated: number;
  summary?: string;
  folderId?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  citations?: string[];
  groundingChunks?: any[];
  thinking?: string;
  attachment?: {
    type: 'image' | 'video';
    url: string;
  };
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface Slide {
  title: string;
  points: string[];
  visualPrompt?: string;
}

export enum AppTab {
  CHAT = 'chat',
  NOTES = 'notes',
  STUDIO = 'studio',
  LIVE = 'live'
}
