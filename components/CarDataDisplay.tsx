
import React, { useState } from 'react';
import { CarSpecification, CatalogRecord } from '../types';
import { Chat } from '@google/genai';
import { exportToCsv, exportToJson } from '../utils/export';
import { TableIcon, JsonIcon, CsvIcon, CodeBracketIcon, ClipboardIcon, CheckIcon, DocumentTextIcon, AcademicCapIcon, PhotoIcon, ChatIcon as ChatTabIcon } from './Icons';
import { Loader } from './Loader';
import { ChatPanel } from './ChatPanel';
import { ProgressState } from '../App';

type TabView = 'database' | 'summary' | 'preview' | 'text' | 'json' | 'chat';

interface CarDataDisplayProps {
  catalog: CatalogRecord | null;
  chat: Chat | null;
  filteredData: CarSpecification[];
  onCellChange: (id: string, key: keyof CarSpecification, value: string | number | string[] | null) => void;
  isProcessing: boolean;
  progress: ProgressState;
  isGeneratingSummary: boolean;
}

const tableHeaders = [
    { key: 'manufacturer', label: 'メーカー' },
    { key: 'modelName', label: '車種名' },
    { key: 'grade', label: 'グレード' },
    { key: 'price', label: '価格 (円)', type: 'number' },
    { key: 'issueDate', label: '発行年月' },
    { key: 'engineType', label: 'エンジン' },
    { key: 'displacement', label: '排気量' },
    { key: 'maxPower', label: '最高出力' },
    { key: 'maxTorque', label: '最大トルク' },
    { key: 'fuelEconomy', label: '燃費' },
    { key: 'options', label: '主なオプション' },
];

// Sub-component for the Database (Table) View
const DatabaseView: React.FC<{
    data: CarSpecification[];
    originalDataLength: number;
    onCellChange: (id: string, key: keyof CarSpecification, value: any) => void;
}> = ({ data, originalDataLength, onCellChange }) => {
    if (originalDataLength === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 p-6 text-center">
                <TableIcon className="h-16 w-16 text-gray-500 mb-4" />
                <h3 className="text-xl font-bold text-white">構造化データなし</h3>
                <p className="text-gray-400 mt-2">AIは表形式のデータを検出できませんでした。</p>
            </div>
        );
    }
    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 p-6 text-center">
                <TableIcon className="h-16 w-16 text-gray-500 mb-4" />
                <h3 className="text-xl font-bold text-white">該当データなし</h3>
                <p className="text-gray-400 mt-2">フィルター条件に一致するデータが見つかりませんでした。</p>
            </div>
        );
    }
    return (
        <>
            <p className="text-xs text-gray-400 px-6 pb-2 -mt-4">ヒント: セルを直接クリックして内容を編集できます。</p>
            <div className="overflow-x-auto">
                <table className="w-full min-w-max text-sm text-left text-gray-300">
                <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                    <tr>{tableHeaders.map(h => <th key={h.key} scope="col" className="px-6 py-3 font-medium tracking-wider">{h.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {data.map(row => (
                    <tr key={row.id} className="hover:bg-gray-700/50 transition-colors">
                        {tableHeaders.map(header => (
                        <td key={header.key} className="px-6 py-4">
                            <input
                                type={header.type || 'text'}
                                className="w-full bg-transparent focus:bg-gray-700 rounded-md p-1 -m-1 outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                                value={header.key === 'options' ? (row.options || []).join(', ') : (row[header.key as keyof CarSpecification] as string | number) ?? ''}
                                onChange={e => {
                                    const val = e.target.value;
                                    const finalValue = header.key === 'options' ? val.split(',').map(s => s.trim()).filter(Boolean) : header.type === 'number' ? (val === '' ? null : parseFloat(val)) : val;
                                    onCellChange(row.id, header.key as keyof CarSpecification, finalValue);
                                }}
                            />
                        </td>
                        ))}
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
        </>
    );
};

// Sub-component for Raw JSON and Text Views
const RawDataView: React.FC<{ rawData: string; type: 'json' | 'text' }> = ({ rawData, type }) => {
    const [isCopied, setIsCopied] = useState(false);
    const handleCopy = () => {
        if (!rawData) return;
        let dataToCopy = rawData;
        if (type === 'json') {
            try { dataToCopy = JSON.stringify(JSON.parse(rawData), null, 2); } catch { /* use raw */ }
        }
        navigator.clipboard.writeText(dataToCopy).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <div className="relative">
            <button onClick={handleCopy} className="absolute top-0 right-2 bg-gray-700 hover:bg-gray-600 text-gray-200 py-1 px-3 rounded-lg text-xs flex items-center gap-2 z-10">
                {isCopied ? <CheckIcon className="h-4 w-4 text-green-400" /> : <ClipboardIcon className="h-4 w-4" />}
                {isCopied ? 'コピー完了' : 'コピー'}
            </button>
            <pre className="bg-gray-900 text-sm rounded-lg p-4 overflow-x-auto max-h-[600px] whitespace-pre-wrap leading-relaxed">
                <code className={type === 'json' ? 'text-cyan-300' : 'text-gray-300'}>
                    {type === 'json' && rawData ? (() => { try { return JSON.stringify(JSON.parse(rawData), null, 2); } catch { return rawData; } })() : (rawData || `生${type === 'json' ? 'JSON' : 'テキスト'}データがありません。`)}
                </code>
            </pre>
        </div>
    );
};

// Sub-component for AI Summary View
const SummaryView: React.FC<{ summary?: string; isLoading: boolean }> = ({ summary, isLoading }) => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <Loader />
                <p className="text-lg font-semibold text-gray-300 mt-4">AIが要約を生成中...</p>
            </div>
        );
    }
    return (
        <div className="prose prose-invert prose-p:text-gray-300 prose-headings:text-white max-w-none whitespace-pre-wrap leading-relaxed">
            {summary ? <p>{summary}</p> : <p>要約データがありません。</p>}
        </div>
    );
};

// Sub-component for Catalog Preview View
const CatalogPreviewView: React.FC<{ images?: string[] }> = ({ images }) => {
    if (!images || images.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-96 p-6 text-center">
                <PhotoIcon className="h-16 w-16 text-gray-500 mb-4" />
                <h3 className="text-xl font-bold text-white">プレビュー画像なし</h3>
                <p className="text-gray-400 mt-2">このカタログにはプレビュー用の画像データが保存されていません。</p>
            </div>
        );
    }
    return (
        <div className="max-h-[70vh] overflow-y-auto space-y-4 pr-2 -mr-6">
            {images.map((img, index) => (
                <div key={index} className="bg-gray-900 p-2 rounded-lg">
                    <img src={img} alt={`Catalog Page ${index + 1}`} className="w-full h-auto rounded" />
                    <p className="text-center text-xs text-gray-500 mt-2">ページ {index + 1}</p>
                </div>
            ))}
        </div>
    );
};


export const CarDataDisplay: React.FC<CarDataDisplayProps> = ({ catalog, chat, filteredData, onCellChange, isProcessing, progress, isGeneratingSummary }) => {
  const [activeTab, setActiveTab] = useState<TabView>('database');

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-800 rounded-lg p-6 shadow-lg">
        <Loader />
        <p className="text-lg font-semibold text-gray-300 mt-4">AIがデータを解析中...</p>
        <p className="text-gray-400">カタログの規模により数分かかる場合があります。</p>
      </div>
    );
  }
  
  if (!catalog) {
     return (
       <div className="flex flex-col items-center justify-center h-96 bg-gray-800 rounded-lg p-6 shadow-lg text-center">
        <TableIcon className="h-16 w-16 text-gray-500 mb-4" />
        <h3 className="text-xl font-bold text-white">データを待機中</h3>
        <p className="text-gray-400 mt-2">
            左のパネルから新しいカタログを追加するか、<br />保存済みのカタログを選択してください。
        </p>
      </div>
    );
  }
  
  const TABS: { id: TabView; icon: React.FC<any>; label: string; }[] = [
      { id: 'database', icon: TableIcon, label: 'データベース' },
      { id: 'summary', icon: AcademicCapIcon, label: 'AI要約' },
      { id: 'preview', icon: PhotoIcon, label: 'カタログプレビュー' },
      { id: 'text', icon: DocumentTextIcon, label: '抽出テキスト' },
      { id: 'json', icon: CodeBracketIcon, label: '生JSON' },
      { id: 'chat', icon: ChatTabIcon, label: 'AIチャット' },
  ];

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 border-b border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <nav className="flex flex-wrap items-center gap-2">
            {TABS.map(tab => (
                 <button key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors font-semibold ${activeTab === tab.id ? 'bg-cyan-500 text-white shadow' : 'text-gray-300 hover:bg-gray-700'}`}>
                    <tab.icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                 </button>
            ))}
        </nav>
        {activeTab === 'database' && catalog.extractedData.length > 0 && (
             <div className="flex items-center gap-2 self-end sm:self-center">
                <button onClick={() => exportToJson(filteredData, 'car_data.json')} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-3 rounded-lg text-sm"><JsonIcon className="h-4 w-4" />JSON</button>
                <button onClick={() => exportToCsv(filteredData, tableHeaders.map(h => h.label), tableHeaders.map(h => h.key as keyof CarSpecification), 'car_data.csv')} className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 py-2 px-3 rounded-lg text-sm"><CsvIcon className="h-4 w-4" />CSV</button>
            </div>
        )}
      </div>
      
      <div className="p-6">
        {activeTab === 'database' && <DatabaseView data={filteredData} originalDataLength={catalog.extractedData.length} onCellChange={onCellChange} />}
        {activeTab === 'summary' && <SummaryView summary={catalog.summary} isLoading={isGeneratingSummary} />}
        {activeTab === 'preview' && <CatalogPreviewView images={catalog.images} />}
        {activeTab === 'text' && <RawDataView rawData={catalog.rawText} type="text" />}
        {activeTab === 'json' && <RawDataView rawData={catalog.rawJson} type="json" />}
        {activeTab === 'chat' && (
            <div className="-m-6"> 
                {chat ? <ChatPanel chat={chat} /> : 
                <div className="p-6 text-center text-gray-400">AIチャットは構造化データが抽出された場合に利用可能です。</div>}
            </div>
        )}
      </div>
    </div>
  );
};
