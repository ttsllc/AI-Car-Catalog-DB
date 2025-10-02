import { GoogleGenAI, Type, GenerateContentResponse, Chat } from "@google/genai";
import { CarSpecification } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const carDataSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      manufacturer: { type: Type.STRING, description: "自動車メーカー名 (例: 'トヨタ')" },
      modelName: { type: Type.STRING, description: "車種名 (例: 'プリウス')" },
      grade: { type: Type.STRING, description: "グレード (例: 'G')" },
      price: { type: Type.NUMBER, description: "車両本体価格 (円)" },
      issueDate: { type: Type.STRING, description: "カタログの発行年月 (例: '2023年1月')" },
      engineType: { type: Type.STRING, description: "エンジン種類 (例: '1.8L 2ZR-FXE')" },
      displacement: { type: Type.STRING, description: "総排気量 (例: '1.797L')" },
      maxPower: { type: Type.STRING, description: "最高出力 (例: '72kW(98PS)/5,200r.p.m.')" },
      maxTorque: { type: Type.STRING, description: "最大トルク (例: '142N・m(14.5kgf・m)/3,600r.p.m.')" },
      fuelEconomy: { type: Type.STRING, description: "燃費 (WLTCモード, km/L)" },
      options: {
        type: Type.ARRAY,
        description: "そのグレードで選択可能な主なメーカーオプションやパッケージオプションのリスト (例: ['ナビゲーションシステム', '本革シート', 'サンルーフ'])",
        items: {
          type: Type.STRING
        }
      },
    },
    required: ["manufacturer", "modelName", "grade", "price"],
  },
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timed out after ${ms} ms`));
    }, ms);

    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(reason => {
        clearTimeout(timer);
        reject(reason);
      });
  });
}

export async function extractCarDataFromImages(base64Images: string[]): Promise<{ parsedData: CarSpecification[], rawJson: string }> {
  const imageParts = base64Images.map(img => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: img.split(',')[1],
    },
  }));

  const prompt = `
    あなたは自動車データ分析の専門家です。
    提供された自動車カタログの画像から、メーカー名、発行年月、各車種・各グレードのスペック情報、そして選択可能な主なオプション装備（メーカーオプション、パッケージオプション等）を正確に抽出してください。
    発行年月はカタログの表紙や裏表紙、スペック一覧表の隅などに記載されていることが多いです。
    出力は指定されたJSONスキーマに厳密に従ってください。
    カタログ内に記載がない項目については、nullとしてください。
    すべてのページを分析し、見つけられる限りのすべての車種・グレードのバリエーションをリストアップしてください。
  `;

  const contents = {
    parts: [
      { text: prompt },
      ...imageParts
    ]
  };
  
  try {
    const generateContentPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        responseMimeType: 'application/json',
        responseSchema: carDataSchema,
      }
    });

    // Add a 3-minute timeout to the API call
    const response: GenerateContentResponse = await withTimeout(generateContentPromise, 180000);

    const jsonText = response.text.trim();
    if (!jsonText) {
        throw new Error("AIから空の応答が返されました。");
    }
    const parsedJson: Omit<CarSpecification, 'id'>[] = JSON.parse(jsonText);
    
    // Add a unique ID for React keys
    const parsedData = parsedJson.map((item, index) => ({
      ...item,
      id: `${Date.now()}-${index}`
    }));

    return { parsedData, rawJson: jsonText };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && error.message.includes("timed out")) {
        throw new Error("AIによるデータ抽出がタイムアウトしました。カタログが大きすぎるか、複雑すぎる可能性があります。");
    }
    throw new Error("AIによるデータ抽出に失敗しました。画像の品質が低いか、サポートされていない形式のカタログである可能性があります。");
  }
}

export async function extractRawTextFromImages(base64Images: string[]): Promise<string> {
    const imageParts = base64Images.map(img => ({
        inlineData: {
            mimeType: 'image/jpeg',
            data: img.split(',')[1],
        },
    }));

    const prompt = `
        提供されたカタログの画像から、書かれているすべてのテキストを抽出してください。
        レイアウトやフォーマットを可能な限り維持し、ページごとテキストを結合して、一つの連続したテキストブロックとして出力してください。
        ヘッダー、フッター、注釈など、ページ上のすべてのテキストを含めてください。
    `;

    const contents = {
        parts: [
            { text: prompt },
            ...imageParts
        ]
    };

    try {
        const generateContentPromise = ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents,
        });

        const response: GenerateContentResponse = await withTimeout(generateContentPromise, 180000);
        return response.text.trim();
    } catch (error) {
        console.error("Error calling Gemini API for raw text extraction:", error);
        if (error instanceof Error && error.message.includes("timed out")) {
            throw new Error("AIによるテキスト抽出がタイムアウトしました。");
        }
        throw new Error("AIによるテキスト抽出に失敗しました。");
    }
}


export function createChat(extractedData: CarSpecification[]): Chat {
  const systemInstruction = `
    あなたは自動車カタログのデータに詳しい専門家です。
    以下のJSONデータをコンテキストとして、ユーザーからの質問に日本語で回答してください。
    このデータはユーザーがアップロードしたカタログから抽出されたものです。
    データにない情報については、データからはわからない旨を伝えてください。

    データ:
    ${JSON.stringify(extractedData, null, 2)}
  `;

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: systemInstruction,
    },
  });
  return chat;
}