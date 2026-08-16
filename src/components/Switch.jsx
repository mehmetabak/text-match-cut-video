// src/components/Switch.jsx
import React from 'react';

export default function Switch({ label, checked, onChange }) {
  const handleChange = (e) => {
    if (typeof onChange === 'function') {
      const isChecked = Boolean(e?.target ? e.target.checked : e);
      const eventObj = {
        target: { checked: isChecked },
        currentTarget: { checked: isChecked },
        nativeEvent: e?.nativeEvent || e,
        stopPropagation: () => e?.stopPropagation?.(),
        preventDefault: () => e?.preventDefault?.(),
        valueOf: () => isChecked,
        toString: () => String(isChecked)
      };
      onChange(eventObj);
    }
  };

  return (
    <label className="flex items-center justify-between cursor-pointer">
      {label && <span className="text-sm font-medium text-gray-300">{label}</span>}
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={Boolean(checked)}
          onChange={handleChange}
        />
        <div className={`block w-14 h-8 rounded-full transition ${checked ? 'bg-accent shadow-sm' : 'bg-zinc-700'}`}></div>
        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${checked ? 'transform translate-x-6' : ''}`}></div>
      </div>
    </label>
  );
}