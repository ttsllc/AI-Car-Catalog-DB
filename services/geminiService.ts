
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

/**
 * Wraps a promise with a timeout.
 */
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

/**
 * Handles errors from the Gemini API and returns a user-friendly Error object.
 * @param error The error caught from the API call.
 * @param context A string describing the context of the API call (e.g., 'データ抽出').
 * @returns An Error object with a user-friendly message.
 */
function handleGeminiError(error: any, context: string): Error {
  console.error(`Error during Gemini API call (${context}):`, error);

  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes("api key not valid") || errorMessage.includes("api_key_invalid")) {
      return new Error("APIキーが無効か、設定されていません。環境変数を確認してください。");
    }
    if (errorMessage.includes("rate limit") || errorMessage.includes("resource_exhausted") || errorMessage.includes("429")) {
      return new Error(`APIの利用回数制限を超えました。しばらく待ってから再度お試しください。(コンテキスト: ${context})`);
    }
    if (errorMessage.includes("billing") || errorMessage.includes("project_disabled")) {
        return new Error("Google Cloudプロジェクトの課金設定に問題がある可能性があります。設定を確認してください。");
    }
    if (errorMessage.includes("timed out")) {
      return new Error(`AIによる${context}がタイムアウトしました。カタログが大きすぎるか、複雑すぎる可能性があります。`);
    }
    // Return a more generic but still informative error from the original message
    return new Error(`AIによる${context}中にエラーが発生しました: ${error.message}`);
  }

  return new Error(`AIによる${context}中に不明なエラーが発生しました。`);
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

    const response: GenerateContentResponse = await withTimeout(generateContentPromise, 600000);

    const jsonText = response.text.trim();
    if (!jsonText) {
        throw new Error("AIから空の応答が返されました。");
    }
    const parsedJson: Omit<CarSpecification, 'id'>[] = JSON.parse(jsonText);
    
    const parsedData = parsedJson.map((item, index) => ({
      ...item,
      id: `${Date.now()}-${index}`
    }));

    return { parsedData, rawJson: jsonText };

  } catch (error) {
    throw handleGeminiError(error, '構造化データ抽出');
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

        const response: GenerateContentResponse = await withTimeout(generateContentPromise, 600000);
        return response.text.trim();
    } catch (error) {
        throw handleGeminiError(error, 'テキスト抽出');
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

export async function generateSummary(text: string): Promise<string> {
  if (!text.trim()) {
    return "要約対象のテキストがありません。";
  }

  const prompt = `
    提供された自動車カタログのテキストから、以下の点を盛り込んだ簡潔な要約を300字から400字程度で作成してください。
    - カタログ全体の概要
    - 主な車種やアピールポイント
    - ターゲットとしている顧客層
    
    出力は自然な日本語の文章にしてください。
    ---
    テキスト:
    ${text}
  `;

  try {
    const generateContentPromise = ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const response: GenerateContentResponse = await withTimeout(generateContentPromise, 120000); // 2 min timeout
    return response.text.trim();
  } catch (error) {
    throw handleGeminiError(error, '要約生成');
  }
}
