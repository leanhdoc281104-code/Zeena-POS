import React from 'react';

interface Props {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export const DateRangeFilter: React.FC<Props> = ({ startDate, endDate, onStartDateChange, onEndDateChange }) => {
  return (
    <div className="flex items-center gap-3 bg-white p-2 sm:p-3 rounded-xl border border-gray-200 shadow-sm print:hidden flex-wrap">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 font-medium">من:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="p-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-gray-50"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 font-medium">إلى:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="p-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-pink-500 bg-gray-50"
        />
      </div>
    </div>
  );
};
