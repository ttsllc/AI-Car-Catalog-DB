
import { CarSpecification } from '../types';

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function exportToJson(data: CarSpecification[], fileName: string) {
  const jsonString = JSON.stringify(data, null, 2);
  downloadFile(jsonString, fileName, 'application/json');
}

export function exportToCsv(data: CarSpecification[], headers: string[], keys: (keyof CarSpecification)[], fileName: string) {
  const escapeCsvCell = (cell: any) => {
    if (cell === null || cell === undefined) {
      return '';
    }
    const str = String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.join(',');
  const dataRows = data.map(row => 
    keys.map(key => escapeCsvCell(row[key])).join(',')
  );

  const csvContent = [headerRow, ...dataRows].join('\n');
  downloadFile(csvContent, fileName, 'text/csv;charset=utf-8;');
}
