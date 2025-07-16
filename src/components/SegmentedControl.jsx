import React from 'react';

export default function SegmentedControl({ label, options, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <div className="grid grid-cols-3 gap-1 bg-zinc-800 p-1 rounded-md">
        {options.map(({ label: optLabel, value: optValue }) => (
          <button
            key={optValue}
            onClick={() => onChange(optValue)}
            className={`w-full py-1.5 text-sm font-semibold rounded transition-colors duration-200 ${
              value === optValue ? 'bg-accent text-white' : 'text-gray-400 hover:bg-zinc-700'
            }`}
          >
            {optLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
