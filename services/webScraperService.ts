/**
 * Fetch web page content using a CORS proxy
 * Note: For production, this should be moved to a server-side API route
 */
export async function fetchWebPageContent(url: string): Promise<string> {
  try {
    // Validate URL
    new URL(url);

    // Use CORS proxy for client-side fetching
    // Note: This is a temporary solution. For production, use a server-side API.
    const corsProxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

    const response = await fetch(corsProxyUrl);

    if (!response.ok) {
      throw new Error(`HTTPエラー: ${response.status}`);
    }

    const data = await response.json();
    return data.contents;

  } catch (error) {
    if (error instanceof TypeError && error.message.includes('URL')) {
      throw new Error('無効なURLです。正しいURLを入力してください。');
    }
    if (error instanceof Error) {
      throw new Error(`Webページの取得に失敗しました: ${error.message}`);
    }
    throw new Error('Webページの取得中に不明なエラーが発生しました。');
  }
}
