// src/components/StatusOverlay.jsx
import React from 'react';
import { t } from '../lib/i18n';

export default function StatusOverlay({ isGenerating, progress, videoUrl, phrase, lang, onClose }) {
  if (!isGenerating && !videoUrl) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-lg shadow-2xl p-8 w-full max-w-2xl text-center">
        {isGenerating && (
          <>
            <h2 className="text-2xl font-bold text-white mb-4">{t('generatingTitle', lang)}</h2>
            <div className="w-full bg-zinc-700 rounded-full h-4">
              <div
                className="bg-accent h-4 rounded-full transition-all duration-150"
                style={{ width: `${progress}%` }}>
              </div>
            </div>
            <p className="text-gray-400 mt-2">{Math.round(progress)}%</p>
          </>
        )}

        {videoUrl && (
          <>
            <h2 className="text-2xl font-bold text-white mb-4">{t('statusSuccess', lang)}</h2>
            <div className="aspect-video bg-black rounded-md mb-6">
              <video controls src={videoUrl} className="w-full h-full object-contain"></video>
            </div>
            <a
              href={videoUrl}
              download={`match_cut_${phrase.replace(/\s+/g, '_')}.webm`}
              className="inline-block bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 transition-all">
              {t('downloadButton', lang)}
            </a>
          </>
        )}

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition text-2xl">×</button>
      </div>
    </div>
  );
}