import React from 'react';
import Switch from './Switch';
import SegmentedControl from './SegmentedControl';
import { useSettingsStore } from '../store/settingsStore';
import { t } from '../lib/i18n';

const Input = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
    <input {...props} className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent" />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>
    <select {...props} className="w-full p-2 bg-zinc-800 border border-zinc-600 rounded-md focus:ring-2 focus:ring-accent">
      {children}
    </select>
  </div>
);

const SettingsPanel = ({ onGenerate }) => {
  const settings = useSettingsStore();
  const { setSetting, lang } = settings;

  const handleInputChange = (e) => {
    const value = e.target.type === 'range' ? parseFloat(e.target.value) : e.target.value;
    setSetting(e.target.name, value);
  };

  const makeOptions = (values) =>
    values.map((val) => ({
      value: val,
      label: t(val.toLowerCase(), lang), // 'Medium' → t('medium', lang) → 'Orta'
    }));

  const videoLengthOptions = makeOptions(['Short', 'Medium', 'Long']);
  const blurOptions = makeOptions(['Low', 'Medium', 'High']);

  return (
    <div className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700/50 p-4 md:p-6 rounded-lg h-full shadow-lg flex flex-col">
      <h2 className="text-xl font-bold text-white flex-shrink-0">{t('customize', lang)}</h2>

      <div className="flex-grow space-y-5 border-t border-zinc-700 mt-4 pt-4 overflow-y-auto pr-2">
        <Input label={t('phraseLabel', lang)} name="phrase" value={settings.phrase} onChange={handleInputChange} />
        <Select label={t('fontFamilyLabel', lang)} name="fontFamily" value={settings.fontFamily} onChange={handleInputChange}>
          <option>'Times New Roman', Times, serif</option>
          <option>'Arial', Helvetica, sans-serif</option>
          <option>'Courier New', Courier, monospace</option>
        </Select>
        <SegmentedControl
          label={t('videoLengthLabel', lang)}
          options={videoLengthOptions}
          value={settings.videoLength}
          onChange={(v) => setSetting('videoLength', v)}
        />
        <SegmentedControl
          label={t('blurLabel', lang)}
          options={blurOptions}
          value={settings.blurIntensity}
          onChange={(v) => setSetting('blurIntensity', v)}
        />
        <div className="pt-2">
          <label className="block text-sm font-medium text-gray-400">
            {t('speedLabel', lang)}: {settings.speed}x
          </label>
          <input type="range" name="speed" min="0.5" max="2.5" step="0.25" value={settings.speed} onChange={handleInputChange}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
        </div>
        <Switch label={t('darkThemeLabel', lang)} checked={settings.darkTheme} onChange={(e) => setSetting('darkTheme', e.target.checked)} />
        <Switch label={t('highlightLabel', lang)} checked={settings.textHighlight} onChange={(e) => setSetting('textHighlight', e.target.checked)} />
      </div>

      <div className="border-t border-zinc-700 pt-4 flex-shrink-0">
        <label className="block text-sm font-medium text-gray-400 mb-2">{t('formatLabel', lang)}</label>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setSetting('format', 'horizontal')}
            className={`p-2 rounded-md font-semibold transition-colors ${settings.format === 'horizontal' ? 'bg-accent text-white ring-2 ring-offset-2 ring-offset-zinc-900 ring-accent' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
            {t('formatHorizontal', lang)}
          </button>
          <button onClick={() => setSetting('format', 'vertical')}
            className={`p-2 rounded-md font-semibold transition-colors ${settings.format === 'vertical' ? 'bg-accent text-white ring-2 ring-offset-2 ring-offset-zinc-900 ring-accent' : 'bg-zinc-700 hover:bg-zinc-600'}`}>
            {t('formatVertical', lang)}
          </button>
        </div>
      </div>

      <button onClick={onGenerate} disabled={settings.isGenerating}
        className="w-full bg-green-600 text-white font-bold py-3 rounded-md hover:bg-green-700 transition-all disabled:bg-gray-500 disabled:cursor-not-allowed mt-4 flex-shrink-0">
        {settings.isGenerating ? t('generatingButton', lang) : t('generateButton', lang)}
      </button>
    </div>
  );
};

export default React.memo(SettingsPanel);
