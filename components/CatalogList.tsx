import React from 'react';
import { CatalogRecord } from '../types';
import { DatabaseIcon, TrashIcon } from './Icons';

interface CatalogListProps {
  catalogs: CatalogRecord[];
  selectedId: number | null;
  onSelect: (catalog: CatalogRecord) => void;
  onDelete: (id: number) => void;
}

export const CatalogList: React.FC<CatalogListProps> = ({ catalogs, selectedId, onSelect, onDelete }) => {
  
  const handleDeleteClick = (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent the onSelect from firing when deleting
    if (window.confirm('このカタログデータを削除してもよろしいですか？この操作は取り消せません。')) {
      onDelete(id);
    }
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <DatabaseIcon className="h-6 w-6 text-cyan-400" />
        <h2 className="text-lg font-semibold">保存済みカタログ</h2>
      </div>
      <div className="max-h-96 overflow-y-auto space-y-2 pr-2 -mr-4">
        {catalogs.length > 0 ? (
          catalogs.map(catalog => (
            <div
              key={catalog.id}
              onClick={() => onSelect(catalog)}
              className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${selectedId === catalog.id ? 'bg-cyan-500/20 ring-1 ring-cyan-500' : 'bg-gray-700/50 hover:bg-gray-700'}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(catalog)}
            >
              <div className="flex-1 overflow-hidden">
                <p className={`font-semibold truncate ${selectedId === catalog.id ? 'text-cyan-300' : 'text-white'}`}>
                  {catalog.fileName}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(catalog.createdAt).toLocaleString()}
                </p>
              </div>
              <button 
                onClick={(e) => handleDeleteClick(e, catalog.id)}
                className="ml-2 p-2 rounded-full text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors flex-shrink-0"
                aria-label={`${catalog.fileName} を削除`}
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">
            保存されたカタログはまだありません。
          </p>
        )}
      </div>
    </div>
  );
};
