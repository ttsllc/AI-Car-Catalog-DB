import React, { useMemo } from 'react';
import { CarSpecification } from '../types';
import { FilterIcon, ResetIcon } from './Icons';

interface Filters {
  manufacturer: string;
  modelName: string;
  issueDate: string;
  option: string;
}

interface FilterControlsProps {
  data: CarSpecification[];
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
}

export const FilterControls: React.FC<FilterControlsProps> = ({ data, filters, setFilters }) => {

  const filterOptions = useMemo(() => {
    const manufacturers = [...new Set(data.map(item => item.manufacturer).filter(Boolean))];
    const issueDates = [...new Set(data.map(item => item.issueDate).filter(Boolean))];
    
    const filteredByManufacturer = filters.manufacturer
      ? data.filter(item => item.manufacturer === filters.manufacturer)
      : data;
    const modelNames = [...new Set(filteredByManufacturer.map(item => item.modelName).filter(Boolean))];

    return { manufacturers, modelNames, issueDates };
  }, [data, filters.manufacturer]);
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => {
        const newFilters = { ...prev, [name]: value };
        // メーカーが変更されたら車種をリセット
        if (name === 'manufacturer') {
            newFilters.modelName = '';
        }
        return newFilters;
    });
  };

  const resetFilters = () => {
    setFilters({ manufacturer: '', modelName: '', issueDate: '', option: '' });
  };

  const renderSelect = (name: keyof Omit<Filters, 'option'>, label: string, options: string[]) => (
    <div className="flex-1 min-w-[150px]">
      <label htmlFor={name} className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      <select
        id={name}
        name={name}
        value={filters[name]}
        onChange={handleFilterChange}
        className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2"
      >
        <option value="">すべて</option>
        {options.sort().map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <FilterIcon className="h-5 w-5 text-gray-400" />
        <h3 className="text-lg font-semibold text-white">フィルター</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 items-end gap-4">
        {renderSelect('manufacturer', 'メーカー', filterOptions.manufacturers)}
        {renderSelect('modelName', '車種名', filterOptions.modelNames)}
        {renderSelect('issueDate', '発行年月', filterOptions.issueDates)}
        <div className="flex-1 min-w-[150px]">
           <label htmlFor="option" className="block text-xs font-medium text-gray-400 mb-1">オプション (キーワード)</label>
           <input
             type="text"
             id="option"
             name="option"
             value={filters.option}
             onChange={handleFilterChange}
             placeholder="例: サンルーフ"
             className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2"
           />
        </div>
        <div className="lg:col-span-4 flex justify-end">
            <button
              onClick={resetFilters}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 font-semibold py-2 px-4 rounded-lg transition-colors text-sm"
              title="フィルターをリセット"
            >
              <ResetIcon className="h-4 w-4" />
              リセット
            </button>
        </div>
      </div>
    </div>
  );
};
