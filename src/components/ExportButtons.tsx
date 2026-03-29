import React from 'react';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { exportToExcel, printToPDF } from '../utils/export';

interface Props {
  data: any[];
  filename: string;
}

export const ExportButtons: React.FC<Props> = ({ data, filename }) => {
  return (
    <div className="flex gap-2 print:hidden">
      <button
        onClick={() => exportToExcel(data, filename)}
        className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm shadow-sm"
        title="تصدير إلى إكسل"
      >
        <FileSpreadsheet className="w-4 h-4" />
        <span className="hidden sm:inline">إكسل</span>
      </button>
      <button
        onClick={printToPDF}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm shadow-sm"
        title="طباعة / PDF"
      >
        <Printer className="w-4 h-4" />
        <span className="hidden sm:inline">طباعة / PDF</span>
      </button>
    </div>
  );
};
