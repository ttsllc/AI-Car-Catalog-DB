import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Chat } from '@google/genai';
import { FileUpload } from './components/FileUpload';
import { CarDataDisplay } from './components/CarDataDisplay';
import { CatalogList } from './components/CatalogList';
import { FilterControls } from './components/FilterControls';
import { ChatPanel } from './components/ChatPanel';
import { extractCarDataFromImages, createChat, extractRawTextFromImages } from './services/geminiService';
import { CarSpecification, CatalogRecord } from './types';
import * as db from './db';
import { LogoIcon, SparklesIcon } from './components/Icons';

// pdfjs-dist is loaded from CDN in index.html, so we can use the global object.
declare const pdfjsLib: any;

interface Filters {
  manufacturer: string;
  modelName: string;
  issueDate: string;
  option: string;
}

const App: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<CarSpecification[]>([]);
  const [rawJsonOutput, setRawJsonOutput] = useState<string>('');
  const [rawTextOutput, setRawTextOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isJsonLoading, setIsJsonLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('PDFをアップロードしてデータ抽出を開始します。');
  const [filters, setFilters] = useState<Filters>({
    manufacturer: '',
    modelName: '',
    issueDate: '',
    option: '',
  });
  const [chat, setChat] = useState<Chat | null>(null);

  const [savedCatalogs, setSavedCatalogs] = useState<CatalogRecord[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);

  useEffect(() => {
    db.initDB().then(loadCatalogs);
  }, []);

  const loadCatalogs = async () => {
    const catalogs = await db.getAllCatalogs();
    setSavedCatalogs(catalogs);
  };

  const handleSelectCatalog = (catalog: CatalogRecord) => {
    setSelectedCatalogId(catalog.id);
    setPdfFile(null); // Clear file input state
    setExtractedData(catalog.extractedData);
    setRawJsonOutput(catalog.rawJson);
    setRawTextOutput(catalog.rawText);
    setFilters({ manufacturer: '', modelName: '', issueDate: '', option: '' });
    setError(null);
    setIsLoading(false);
    setIsJsonLoading(false);
    if(catalog.extractedData.length > 0) {
      const newChat = createChat(catalog.extractedData);
      setChat(newChat);
      setStatusMessage(`「${catalog.fileName}」のデータを表示中。`);
    } else {
      setChat(null);
      setStatusMessage(`「${catalog.fileName}」には抽出された構造化データがありません。`);
    }
  };
  
  const handleDeleteCatalog = async (id: number) => {
    await db.deleteCatalog(id);
    await loadCatalogs();
    if (selectedCatalogId === id) {
      // Reset view if the deleted catalog was the selected one
      setSelectedCatalogId(null);
      setExtractedData([]);
      setRawJsonOutput('');
      setRawTextOutput('');
      setChat(null);
      setStatusMessage('カタログが削除されました。');
    }
  };

  const handleFileChange = useCallback(async (file: File) => {
    if (!file) return;
    setPdfFile(file);
    setSelectedCatalogId(null);
    setExtractedData([]);
    setRawJsonOutput('');
    setRawTextOutput('');
    setFilters({ manufacturer: '', modelName: '', issueDate: '', option: '' });
    setError(null);
    setIsLoading(true);
    setChat(null);
    setStatusMessage('PDFを処理中...');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event.target?.result) return;
        const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        const numPages = pdf.numPages;
        const imagePromises: Promise<string>[] = [];
        setStatusMessage(`PDFの ${numPages} ページを画像に変換中...`);
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            imagePromises.push(Promise.resolve(canvas.toDataURL('image/jpeg', 0.85)));
          }
        }
        canvas.remove();
        
        const images = await Promise.all(imagePromises);
        setStatusMessage(`${numPages} ページの準備ができました。「データ抽出」をクリックしてください。`);
        await handleExtractData(images, file.name);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("PDF processing error:", err);
      setError('PDFの処理中にエラーが発生しました。');
      setStatusMessage('エラーが発生しました。もう一度お試しください。');
      setIsLoading(false);
    }
  }, []);

  const handleExtractData = async (images: string[], fileName: string) => {
    if (images.length === 0) {
      setError('最初にPDFを処理してください。');
      return;
    }
    // Reset data states
    setIsLoading(true);
    setIsJsonLoading(true);
    setError(null);
    setExtractedData([]);
    setRawJsonOutput('');
    setRawTextOutput('');
    setFilters({ manufacturer: '', modelName: '', issueDate: '', option: '' });
    setChat(null);
    setStatusMessage('AIによるデータ抽出を開始しました...');

    const textPromise = extractRawTextFromImages(images);
    const jsonPromise = extractCarDataFromImages(images);

    let extractedRawText = '';
    let extractedJsonData: { parsedData: CarSpecification[], rawJson: string } = { parsedData: [], rawJson: ''};

    try {
        setStatusMessage('AIがテキストを抽出中です...');
        extractedRawText = await textPromise;
        setRawTextOutput(extractedRawText);
    } catch (err) {
        console.error("Gemini API error (Text):", err);
        setError(err instanceof Error ? err.message : 'AIによるテキスト抽出中に不明なエラーが発生しました。');
    } finally {
        setIsLoading(false);
    }

    try {
        setStatusMessage('AIが構造化データを生成中です...');
        extractedJsonData = await jsonPromise;
        setExtractedData(extractedJsonData.parsedData);
        setRawJsonOutput(extractedJsonData.rawJson);

        if (extractedJsonData.parsedData.length > 0) {
            const newChat = createChat(extractedJsonData.parsedData);
            setChat(newChat);
        }
    } catch (err) {
        console.error("Gemini API error (JSON):", err);
        const errorMessage = err instanceof Error ? err.message : 'AIによる構造化データ抽出中に不明なエラーが発生しました。';
        setError(prev => prev ? `${prev}\n${errorMessage}` : errorMessage);
    } finally {
        setIsJsonLoading(false);
    }
     
    try {
      setStatusMessage('抽出データをデータベースに保存中...');
      const newCatalog = await db.saveCatalog({
        fileName,
        createdAt: new Date(),
        extractedData: extractedJsonData.parsedData,
        rawJson: extractedJsonData.rawJson,
        rawText: extractedRawText,
      });
      await loadCatalogs();
      setSelectedCatalogId(newCatalog.id);
      if (!error) {
        setStatusMessage('データ抽出と保存が完了しました。');
      } else {
        setStatusMessage('一部エラーが発生しましたが、データは保存されました。');
      }
    } catch (dbError) {
      console.error('Failed to save to DB:', dbError);
      setError(prev => prev ? `${prev}\nデータベースへの保存に失敗しました。` : 'データベースへの保存に失敗しました。');
      setStatusMessage('データ抽出は完了しましたが、データベースへの保存に失敗しました。');
    }
  };

  const filteredData = useMemo(() => {
    return extractedData.filter(item => {
      const searchOption = filters.option.toLowerCase();
      return (
        (filters.manufacturer ? item.manufacturer === filters.manufacturer : true) &&
        (filters.modelName ? item.modelName === filters.modelName : true) &&
        (filters.issueDate ? item.issueDate === filters.issueDate : true) &&
        (searchOption ? item.options && item.options.some(opt => opt.toLowerCase().includes(searchOption)) : true)
      );
    });
  }, [extractedData, filters]);
  
  const handleCellChange = (id: string, key: keyof CarSpecification, value: string | number | string[] | null) => {
    setExtractedData(prevData =>
      prevData.map(item =>
        item.id === id ? { ...item, [key]: value } : item
      )
    );
  };
  
  const hasData = extractedData.length > 0 || !!rawJsonOutput || !!rawTextOutput;
  const isDisplayingData = !!selectedCatalogId || hasData;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <header className="bg-gray-900/80 backdrop-blur-md sticky top-0 z-20 border-b border-gray-700">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <LogoIcon className="h-8 w-8 text-cyan-400" />
              <h1 className="text-xl font-bold tracking-tight text-white">
                自動車カタログAIデータベース
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <aside className="lg:col-span-4 xl:col-span-3 space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
              <h2 className="text-lg font-semibold mb-4">1. 新規カタログを追加</h2>
              <FileUpload onFileSelect={handleFileChange} disabled={isLoading || isJsonLoading} />
               <p className="text-sm text-gray-400 mt-4">{statusMessage}</p>
               {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
            </div>
            <CatalogList
              catalogs={savedCatalogs}
              selectedId={selectedCatalogId}
              onSelect={handleSelectCatalog}
              onDelete={handleDeleteCatalog}
            />
          </aside>

          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
             {isDisplayingData ? (
              <>
                {(extractedData.length > 0) &&
                  <FilterControls
                    data={extractedData}
                    filters={filters}
                    setFilters={setFilters}
                  />
                }
                <CarDataDisplay
                  data={filteredData}
                  onCellChange={handleCellChange}
                  isLoading={isLoading}
                  isJsonLoading={isJsonLoading}
                  hasAttemptedExtraction={true}
                  originalDataLength={extractedData.length}
                  rawJson={rawJsonOutput}
                  rawText={rawTextOutput}
                />
                <ChatPanel chat={chat} />
              </>
            ) : (
               <CarDataDisplay
                data={[]}
                onCellChange={() => {}}
                isLoading={isLoading}
                isJsonLoading={false}
                hasAttemptedExtraction={false}
                originalDataLength={0}
                rawJson=""
                rawText=""
              />
            )}
          </div>
        </div>
      </main>
      
      <footer className="py-6 text-center text-sm text-gray-500">
        <p>Powered by Triceratops API. Built for demonstration.</p>
      </footer>
    </div>
  );
};

export default App;
