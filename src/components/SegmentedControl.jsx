import React from 'react';

export default function SegmentedControl({ label, options = [], value, onChange }) {
  const count = options.length;
  const gridColsClass = count === 2 
    ? 'grid-cols-2' 
    : count === 4 
      ? 'grid-cols-2 sm:grid-cols-4' 
      : count === 3 
        ? 'grid-cols-3' 
        : 'grid-cols-2';

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>}
      <div className={`grid ${gridColsClass} gap-1 bg-zinc-800 p-1 rounded-md`}>
        {options.map(({ label: optLabel, value: optValue }) => (
          <button
            key={optValue}
            type="button"
            onClick={() => onChange(optValue)}
            className={`w-full py-1.5 px-2 text-xs sm:text-sm font-semibold rounded transition-colors duration-200 text-center truncate ${
              value === optValue ? 'bg-accent text-white shadow-sm' : 'text-gray-400 hover:bg-zinc-700/60 hover:text-zinc-200'
            }`}
          >
            {optLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
