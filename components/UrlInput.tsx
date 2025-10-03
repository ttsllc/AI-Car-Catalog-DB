import React, { useState } from 'react';

interface UrlInputProps {
  onUrlSubmit: (url: string) => void;
  disabled?: boolean;
}

export const UrlInput: React.FC<UrlInputProps> = ({ onUrlSubmit, disabled }) => {
  const [url, setUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onUrlSubmit(url.trim());
      setUrl('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="catalog-url" className="block text-sm font-medium text-gray-300 mb-2">
          カタログURL
        </label>
        <input
          id="catalog-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/catalog"
          disabled={disabled}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          required
        />
      </div>
      <button
        type="submit"
        disabled={disabled || !url.trim()}
        className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-800"
      >
        URLから取得
      </button>
    </form>
  );
};
