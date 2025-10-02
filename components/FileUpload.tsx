import React, { useState, useCallback } from 'react';
import { UploadIcon } from './Icons';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      if (files[0].type === "application/pdf") {
        onFileSelect(files[0]);
      } else {
        alert("PDFファイルのみアップロードできます。");
      }
    }
  }, [onFileSelect, disabled]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const borderStyle = isDragging
    ? 'border-cyan-400 ring-2 ring-cyan-400'
    : 'border-gray-600';

  return (
    <div
      className={`relative flex flex-col items-center justify-center w-full p-8 border-2 ${borderStyle} border-dashed rounded-lg transition-all duration-300 ${disabled ? 'cursor-not-allowed bg-gray-700/50' : 'cursor-pointer bg-gray-700/30 hover:bg-gray-700/60'}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        type="file"
        id="file-upload"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        accept="application/pdf"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <div className="text-center">
        <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm font-semibold text-gray-200">
          PDFをドラッグ＆ドロップ
        </p>
        <p className="text-xs text-gray-400">またはクリックしてファイルを選択</p>
      </div>
    </div>
  );
};
