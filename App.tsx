
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Chat } from '@google/genai';
import { FileUpload } from './components/FileUpload';
import { UrlInput } from './components/UrlInput';
import { CarDataDisplay } from './components/CarDataDisplay';
import { CatalogList } from './components/CatalogList';
import { FilterControls } from './components/FilterControls';
import { ProgressTracker } from './components/ProgressTracker';
import { extractCarDataFromImages, createChat, extractRawTextFromImages, generateSummary, extractCarDataFromWebPage } from './services/geminiService';
import { fetchWebPageContent } from './services/webScraperService';
import { CarSpecification, CatalogRecord } from './types';
import * as db from './db';
import { LogoIcon } from './components/Icons';

// pdfjs-dist is loaded from CDN in index.html, so we can use the global object.
declare const pdfjsLib: any;

export type ProgressStep = 'idle' | 'reading' | 'converting' | 'extractingText' | 'extractingJson' | 'saving' | 'done' | 'error';
export interface ProgressState {
  step: ProgressStep;
  error?: string;
  completedSteps: Set<ProgressStep>;
}

interface Filters {
  manufacturer: string;
  modelName: string;
  issueDate: string;
  option: string;
}

const App: React.FC = () => {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<ProgressState>({
    step: 'idle',
    completedSteps: new Set(),
  });
  const [filters, setFilters] = useState<Filters>({
    manufacturer: '',
    modelName: '',
    issueDate: '',
    option: '',
  });
  const [chat, setChat] = useState<Chat | null>(null);

  const [savedCatalogs, setSavedCatalogs] = useState<CatalogRecord[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogRecord | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState<boolean>(false);
  const selectedCatalogId = selectedCatalog?.id ?? null;

  useEffect(() => {
    db.initDB().then(loadCatalogs);
  }, []);

  const loadCatalogs = async () => {
    const catalogs = await db.getAllCatalogs();
    setSavedCatalogs(catalogs);
  };

  const handleSelectCatalog = async (catalog: CatalogRecord) => {
    setPdfFile(null); // Clear file input state
    setFilters({ manufacturer: '', modelName: '', issueDate: '', option: '' });
    setProgress({ step: 'idle', completedSteps: new Set() });

    if(catalog.extractedData.length > 0) {
      const newChat = createChat(catalog.extractedData);
      setChat(newChat);
    } else {
      setChat(null);
    }
    
    // Generate summary on-demand if it doesn't exist
    if (!catalog.summary && catalog.rawText) {
        setIsGeneratingSummary(true);
        setSelectedCatalog(catalog); // Show existing data first
        try {
            const summary = await generateSummary(catalog.rawText);
            const updatedCatalog = { ...catalog, summary };
            await db.updateCatalog(updatedCatalog);
            setSelectedCatalog(updatedCatalog); // Update state with summary
            setSavedCatalogs(prev => prev.map(c => c.id === updatedCatalog.id ? updatedCatalog : c));
        } catch(e) {
            console.error("Failed to generate summary on demand:", e);
            // On error, just proceed without a summary
        } finally {
            setIsGeneratingSummary(false);
        }
    } else {
        setSelectedCatalog(catalog);
    }
  };
  
  const handleDeleteCatalog = async (id: number) => {
    await db.deleteCatalog(id);
    await loadCatalogs();
    if (selectedCatalogId === id) {
      setSelectedCatalog(null);
      setChat(null);
      setProgress({ step: 'idle', completedSteps: new Set() });
    }
  };

  const resetStateForNewFile = () => {
      setPdfFile(null);
      setSelectedCatalog(null);
      setFilters({ manufacturer: '', modelName: '', issueDate: '', option: '' });
      setChat(null);
  };

  const handleFileChange = useCallback(async (file: File) => {
    if (!file) return;
    
    resetStateForNewFile();
    setPdfFile(file);
    setProgress({ step: 'reading', completedSteps: new Set() });

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (!event.target?.result) {
            setProgress({ step: 'error', error: 'PDFファイルの読み込みに失敗しました。', completedSteps: new Set() });
            return;
        }
        
        setProgress(prev => ({ ...prev, step: 'converting', completedSteps: new Set(prev.completedSteps).add('reading') }));

        const typedArray = new Uint8Array(event.target.result as ArrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        const numPages = pdf.numPages;
        const imagePromises: Promise<string>[] = [];
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 }); // Reduced from 1.5 to 1.0
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            imagePromises.push(Promise.resolve(canvas.toDataURL('image/jpeg', 0.75))); // Balanced quality: readable but smaller
          }
        }
        canvas.remove();
        
        const images = await Promise.all(imagePromises);
        setProgress(prev => ({ ...prev, step: 'extractingText', completedSteps: new Set(prev.completedSteps).add('converting') }));
        await handleExtractData(images, file.name);
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error("PDF processing error:", err);
      const errorMessage = err instanceof Error ? err.message : 'PDFの処理中にエラーが発生しました。';
      setProgress({ step: 'error', error: errorMessage, completedSteps: new Set() });
    }
  }, []);

  const handleExtractData = async (images: string[], fileName: string) => {
    if (images.length === 0) {
      setProgress({ step: 'error', error: 'PDFから画像が抽出できませんでした。', completedSteps: new Set() });
      return;
    }

    let extractedRawText = '';
    let extractedJsonData: { parsedData: CarSpecification[], rawJson: string } = { parsedData: [], rawJson: ''};
    let summary: string | undefined = '';
    const apiErrors: string[] = [];

    try {
      const [textResult, jsonResult] = await Promise.allSettled([
        extractRawTextFromImages(images),
        extractCarDataFromImages(images),
      ]);

      if (textResult.status === 'fulfilled') {
        extractedRawText = textResult.value;
      } else {
        apiErrors.push(textResult.reason instanceof Error ? textResult.reason.message : 'AIによるテキスト抽出中に不明なエラーが発生しました。');
      }

      if (jsonResult.status === 'fulfilled') {
        extractedJsonData = jsonResult.value;
        if (extractedJsonData.parsedData.length > 0) {
            const newChat = createChat(extractedJsonData.parsedData);
            setChat(newChat);
        }
      } else {
        apiErrors.push(jsonResult.reason instanceof Error ? jsonResult.reason.message : 'AIによる構造化データ抽出中に不明なエラーが発生しました。');
      }

      if (apiErrors.length > 0) throw new Error(apiErrors.join('\n'));
      
      if (extractedRawText) {
          try {
              summary = await generateSummary(extractedRawText);
          } catch (summaryError) {
              console.error("Summary generation failed, but continuing:", summaryError);
              // Do not block the whole process if only summary fails
          }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'データ抽出中に予期せぬエラーが発生しました。';
      setProgress(prev => ({ ...prev, step: 'error', error: errorMessage, completedSteps: prev.completedSteps }));
      return;
    }
     
    setProgress(prev => ({ ...prev, step: 'saving', completedSteps: new Set(prev.completedSteps).add('extractingText').add('extractingJson') }));

    if (!extractedRawText && extractedJsonData.parsedData.length === 0) {
      setProgress({ step: 'error', error: 'AIはカタログから有効なデータを抽出できませんでした。', completedSteps: new Set() });
      return;
    }
     
    try {
      const newCatalogData: Omit<CatalogRecord, 'id'> = {
        fileName,
        createdAt: new Date(),
        extractedData: extractedJsonData.parsedData,
        rawJson: extractedJsonData.rawJson,
        rawText: extractedRawText,
        summary,
        images,
      };
      const newCatalog = await db.saveCatalog(newCatalogData);
      
      await loadCatalogs();
      setSelectedCatalog(newCatalog);
      
      setProgress(prev => ({ ...prev, step: 'done', completedSteps: new Set(prev.completedSteps).add('saving') }));
      setTimeout(() => setProgress({ step: 'idle', completedSteps: new Set() }), 5000);

    } catch (dbError) {
      console.error('Failed to save to DB:', dbError);
      const errorMessage = dbError instanceof Error ? dbError.message : 'データベースへの保存に失敗しました。';
      setProgress(prev => ({ ...prev, step: 'error', error: errorMessage, completedSteps: prev.completedSteps }));
    }
  };
  
  const handleUrlSubmit = async (url: string) => {
    resetStateForNewFile();
    setProgress({ step: 'reading', completedSteps: new Set() });

    try {
      // Fetch web page content
      const htmlContent = await fetchWebPageContent(url);
      setProgress(prev => ({ ...prev, step: 'extractingJson', completedSteps: new Set(prev.completedSteps).add('reading') }));

      // Extract data using Gemini
      const { parsedData, rawJson, rawText } = await extractCarDataFromWebPage(htmlContent, url);

      if (parsedData.length > 0) {
        const newChat = createChat(parsedData);
        setChat(newChat);
      }

      setProgress(prev => ({ ...prev, step: 'saving', completedSteps: new Set(prev.completedSteps).add('extractingJson') }));

      // Generate summary
      let summary: string | undefined = '';
      if (rawText) {
        try {
          summary = await generateSummary(rawText);
        } catch (summaryError) {
          console.error("Summary generation failed, but continuing:", summaryError);
        }
      }

      // Save to database (no images for URL-based catalogs)
      const newCatalogData: Omit<CatalogRecord, 'id'> = {
        fileName: new URL(url).hostname,
        createdAt: new Date(),
        extractedData: parsedData,
        rawJson,
        rawText,
        summary,
        images: [], // No images for web-based catalogs
      };

      const newCatalog = await db.saveCatalog(newCatalogData);
      await loadCatalogs();
      setSelectedCatalog(newCatalog);

      setProgress(prev => ({ ...prev, step: 'done', completedSteps: new Set(prev.completedSteps).add('saving') }));
      setTimeout(() => setProgress({ step: 'idle', completedSteps: new Set() }), 5000);

    } catch (error) {
      console.error('URL processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'URLからのデータ取得中にエラーが発生しました。';
      setProgress({ step: 'error', error: errorMessage, completedSteps: new Set() });
    }
  };

  const handleCellChange = (id: string, key: keyof CarSpecification, value: string | number | string[] | null) => {
    if (!selectedCatalog) return;

    const updatedData = selectedCatalog.extractedData.map(item =>
        item.id === id ? { ...item, [key]: value } : item
    );

    setSelectedCatalog(prev => prev ? { ...prev, extractedData: updatedData } : null);
    // Note: This change is temporary and not persisted to DB automatically.
    // A "save" button could be added to persist changes via db.updateCatalog.
  };

  const filteredData = useMemo(() => {
    if (!selectedCatalog) return [];
    return selectedCatalog.extractedData.filter(item => {
      const searchOption = filters.option.toLowerCase();
      return (
        (filters.manufacturer ? item.manufacturer === filters.manufacturer : true) &&
        (filters.modelName ? item.modelName === filters.modelName : true) &&
        (filters.issueDate ? item.issueDate === filters.issueDate : true) &&
        (searchOption ? item.options && item.options.some(opt => opt.toLowerCase().includes(searchOption)) : true)
      );
    });
  }, [selectedCatalog, filters]);
  
  const isProcessing = progress.step !== 'idle' && progress.step !== 'done';
  const isDisplayingData = !!selectedCatalog || isProcessing;

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
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">PDFをアップロード</h3>
                  <FileUpload onFileSelect={handleFileChange} disabled={isProcessing && progress.step !== 'error'} />
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-600"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gray-800 text-gray-400">または</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">WebページのURL</h3>
                  <UrlInput onUrlSubmit={handleUrlSubmit} disabled={isProcessing && progress.step !== 'error'} />
                </div>
              </div>
              {isProcessing && <div className="mt-4"><ProgressTracker progress={progress} /></div>}
            </div>
            <CatalogList
              catalogs={savedCatalogs}
              selectedId={selectedCatalogId}
              onSelect={handleSelectCatalog}
              onDelete={handleDeleteCatalog}
            />
          </aside>

          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            {isDisplayingData && selectedCatalog && selectedCatalog.extractedData.length > 0 &&
              <FilterControls
                data={selectedCatalog.extractedData}
                filters={filters}
                setFilters={setFilters}
              />
            }
             <CarDataDisplay
                catalog={selectedCatalog}
                chat={chat}
                filteredData={filteredData}
                onCellChange={handleCellChange}
                isProcessing={isProcessing}
                progress={progress}
                isGeneratingSummary={isGeneratingSummary}
              />
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
