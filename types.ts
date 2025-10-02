
import { Chat } from '@google/genai';

export interface CarSpecification {
  id: string;
  manufacturer: string | null;
  modelName: string | null;
  grade: string | null;
  price: number | null;
  issueDate: string | null;
  engineType: string | null;
  displacement: string | null;
  maxPower: string | null;
  maxTorque: string | null;
  fuelEconomy: string | null;
  options: string[] | null;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface CatalogRecord {
  id: number;
  fileName: string;
  createdAt: Date;
  extractedData: CarSpecification[];
  rawJson: string;
  rawText: string;
  summary?: string;
  images?: string[];
}
