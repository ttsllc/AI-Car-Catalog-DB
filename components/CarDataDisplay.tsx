import React, { useState } from 'react';
import { CarSpecification } from '../types';
import { exportToCsv, exportToJson } from '../utils/export';
import { TableIcon, JsonIcon, CsvIcon, CodeBracketIcon, ClipboardIcon, CheckIcon, DocumentTextIcon } from './Icons';
import { Loader } from './Loader';

interface CarDataDisplayProps {
  data: CarSpecification[];
  onCellChange: (id: string, key: keyof CarSpecification, value: string | number | string[] | null) => void;
  isLoading: boolean;
  isJsonLoading: boolean;
  hasAttemptedExtraction: boolean;
  originalDataLength: number;
  rawJson: string;
  rawText: string;
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

export const CarDataDisplay: React.FC<CarDataDisplayProps> = ({ data, onCellChange, isLoading, isJsonLoading, hasAttemptedExtraction, originalDataLength, rawJson, rawText }) => {
  const [view, setView] = useState<'table' | 'json' | 'text'>('table');
  const [isJsonCopied, setIsJsonCopied] = useState(false);
  const [isTextCopied, setIsTextCopied] = useState(false);

  const handleExportJson = () => {
    exportToJson(data, 'car_catalog_data.json');
  };

  const handleExportCsv = () => {
    const headers = tableHeaders.map(h => h.label);
    const keys = tableHeaders.map(h => h.key as keyof CarSpecification);
    exportToCsv(data, headers, keys, 'car_catalog_data.csv');
  };

  const handleCopyJson = () => {
    if (!rawJson) return;
    try {
      const prettyJson = JSON.stringify(JSON.parse(rawJson), null, 2);
      navigator.clipboard.writeText(prettyJson).then(() => {
        setIsJsonCopied(true);
        setTimeout(() => setIsJsonCopied(false), 2000);
      });
    } catch (e) {
      console.error("Failed to parse or copy JSON", e);
      navigator.clipboard.writeText(rawJson).then(() => {
        setIsJsonCopied(true);
        setTimeout(() => setIsJsonCopied(false), 2000);
      });
    }
  };

  const handleCopyText = () => {
    if (!rawText) return;
    navigator.clipboard.writeText(rawText).then(() => {
        setIsTextCopied(true);
        setTimeout(() => setIsTextCopied(false), 2000);
    });
  };


  if (isLoading) { // This now only covers PDF processing and initial text extraction
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-800 rounded-lg p-6 shadow-lg">
        <Loader />
        <p className="text-lg font-semibold text-gray-300 mt-4">AIがデータを解析中...</p>
        <p className="text-gray-400">カタログの規模により数分かかる場合があります。</p>
      </div>
    );
  }

  if (hasAttemptedExtraction && !rawText && !rawJson && !isJsonLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-800 rounded-lg p-6 shadow-lg text-center">
        <TableIcon className="h-16 w-16 text-gray-500 mb-4" />
        <h3 className="text-xl font-bold text-white">データがありません</h3>
        <p className="text-gray-400 mt-2">
            抽出プロセスが完了しましたが、データは見つかりませんでした。
        </p>
      </div>
    );
  }
  
  if (!hasAttemptedExtraction) {
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
  
  const renderJsonLoading = (viewType: 'table' | 'json') => (
    <div className={`p-4 sm:p-6 relative ${view === viewType ? '' : 'hidden'}`}>
        <div className="flex flex-col items-center justify-center h-96">
            <Loader />
            <p className="text-lg font-semibold text-gray-300 mt-4">構造化データを生成中...</p>
        </div>
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-gray-700 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-xl font-bold text-white">抽出データ</h2>
          <div className="bg-gray-700 p-1 rounded-lg flex items-center">
            <button
              onClick={() => setView('table')}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${view === 'table' ? 'bg-cyan-500 text-white shadow' : 'text-gray-300 hover:bg-gray-600'}`}
              aria-pressed={view === 'table'}
            >
              <TableIcon className="h-4 w-4" />
              テーブル
            </button>
            <button
              onClick={() => setView('json')}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${view === 'json' ? 'bg-cyan-500 text-white shadow' : 'text-gray-300 hover:bg-gray-600'}`}
              aria-pressed={view === 'json'}
            >
              <CodeBracketIcon className="h-4 w-4" />
              JSON
            </button>
            <button
              onClick={() => setView('text')}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${view === 'text' ? 'bg-cyan-500 text-white shadow' : 'text-gray-300 hover:bg-gray-600'}`}
              aria-pressed={view === 'text'}
            >
              <DocumentTextIcon className="h-4 w-4" />
              テキスト
            </button>
          </div>
          <div className="h-6 w-px bg-gray-600 hidden sm:block"></div>
          <div className="flex items-center gap-2">
             <button
                onClick={handleExportJson}
                disabled={data.length === 0}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <JsonIcon className="h-4 w-4" />
                JSON
            </button>
            <button
                onClick={handleExportCsv}
                disabled={data.length === 0}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-4 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <CsvIcon className="h-4 w-4" />
                CSV
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-400">
          {originalDataLength > 0 ? `${originalDataLength} 件の車両データ` : (isJsonLoading ? '車両データを検索中' : '車両データなし')}
        </p>
      </div>
      
      {view === 'table' && !isJsonLoading && originalDataLength > 0 && (
        <p className="text-xs text-gray-400 px-4 sm:px-6 py-2 bg-gray-800/50 border-b border-gray-700">
            ヒント: セルを直接クリックして内容を編集できます。
        </p>
      )}

      {isJsonLoading && (view === 'table' || view === 'json') ? renderJsonLoading(view) : (
          <>
            {view === 'table' ? (
                originalDataLength > 0 ? (
                  data.length === 0 ? (
                     <div className="flex flex-col items-center justify-center h-96 p-6 text-center">
                        <TableIcon className="h-16 w-16 text-gray-500 mb-4" />
                        <h3 className="text-xl font-bold text-white">該当データなし</h3>
                        <p className="text-gray-400 mt-2">
                            フィルター条件に一致するデータが見つかりませんでした。
                        </p>
                     </div>
                  ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-max text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                            <tr>
                            {tableHeaders.map((header) => (
                                <th key={header.key} scope="col" className="px-6 py-3 font-medium tracking-wider">
                                {header.label}
                                </th>
                            ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {data.map((row) => (
                            <tr key={row.id} className="hover:bg-gray-700/50 transition-colors">
                                {tableHeaders.map((header) => (
                                <td key={header.key} className="px-6 py-4">
                                    <input
                                    type={header.type || 'text'}
                                    className="w-full bg-transparent focus:bg-gray-700 rounded-md p-1 -m-1 outline-none focus:ring-1 focus:ring-cyan-500 transition-all"
                                    value={
                                        header.key === 'options'
                                        ? (row.options || []).join(', ')
                                        : (row[header.key as keyof CarSpecification] as string | number) ?? ''
                                    }
                                    onChange={(e) => {
                                        const rawValue = e.target.value;
                                        let finalValue: string | number | string[] | null;

                                        if (header.key === 'options') {
                                        finalValue = rawValue.split(',').map(s => s.trim()).filter(Boolean);
                                        } else if (header.type === 'number') {
                                        finalValue = rawValue === '' ? null : parseFloat(rawValue);
                                        } else {
                                        finalValue = rawValue;
                                        }
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
                  )
                ) : (
                <div className="flex flex-col items-center justify-center h-96 p-6 text-center">
                    <TableIcon className="h-16 w-16 text-gray-500 mb-4" />
                    <h3 className="text-xl font-bold text-white">構造化データなし</h3>
                    <p className="text-gray-400 mt-2">
                        AIは表形式のデータを検出できませんでした。
                    </p>
                    <p className="text-gray-400 mt-1">
                        「テキスト」または「JSON」ビューで生データを確認してください。
                    </p>
                </div>
                )
            ) : view === 'json' ? (
                <div className="p-4 sm:p-6 relative">
                <button
                    onClick={handleCopyJson}
                    className="absolute top-6 right-8 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-1 px-3 rounded-lg transition-colors text-xs flex items-center gap-2 z-10"
                >
                    {isJsonCopied ? <CheckIcon className="h-4 w-4 text-green-400" /> : <ClipboardIcon className="h-4 w-4" />}
                    {isJsonCopied ? 'コピー完了' : 'コピー'}
                </button>
                <pre className="bg-gray-900 text-cyan-300 text-sm rounded-lg p-4 overflow-x-auto max-h-[600px]">
                    <code>
                        {(() => {
                            if (!rawJson) return "JSONデータがありません。";
                            try {
                                return JSON.stringify(JSON.parse(rawJson), null, 2);
                            } catch {
                                return rawJson; // Show raw text if it's not valid JSON
                            }
                        })()}
                    </code>
                </pre>
                </div>
            ) : ( // view === 'text'
                <div className="p-4 sm:p-6 relative">
                <button
                    onClick={handleCopyText}
                    className="absolute top-6 right-8 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-1 px-3 rounded-lg transition-colors text-xs flex items-center gap-2 z-10"
                >
                    {isTextCopied ? <CheckIcon className="h-4 w-4 text-green-400" /> : <ClipboardIcon className="h-4 w-4" />}
                    {isTextCopied ? 'コピー完了' : 'コピー'}
                </button>
                <pre className="bg-gray-900 text-gray-300 text-sm rounded-lg p-4 overflow-x-auto max-h-[600px] whitespace-pre-wrap leading-relaxed">
                    <code>
                        {rawText || "テキストデータがありません。"}
                    </code>
                </pre>
                </div>
            )}
          </>
      )}
    </div>
  );
};
