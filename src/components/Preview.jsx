// src/components/Preview.jsx
import React from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { t } from '../lib/i18n';

const Preview = ({ canvasRef }) => {
    const { format, isGenerating, progress, videoUrl, phrase, lang } = useSettingsStore();

    return (
        <div className={`w-full h-full bg-zinc-900/50 backdrop-blur-sm border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center p-4 transition-all duration-300`}>
            <canvas ref={canvasRef} className="hidden"></canvas>
            
            {isGenerating && (
                <div className="w-full max-w-md text-center">
                    <h3 className="text-xl font-semibold text-gray-300 mb-4">{t('generatingTitle', lang)}</h3>
                    <div className="w-full bg-zinc-700 rounded-full h-4 overflow-hidden">
                        <div className="bg-accent h-4 rounded-full transition-all duration-150" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-gray-400 mt-2">{Math.round(progress)}%</p>
                </div>
            )}

            {!isGenerating && videoUrl && (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                    <div className={`w-full h-[calc(100%-60px)] flex items-center justify-center ${format === 'vertical' ? 'max-w-xs' : ''}`}>
                        <video controls src={videoUrl} className="max-w-full max-h-full object-contain rounded-md shadow-2xl"></video>
                    </div>
                    <a href={videoUrl} download={`match_cut_${phrase.replace(/\s+/g, '_')}.webm`}
                       className="flex-shrink-0 bg-green-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-700 transition-all">
                        {t('downloadButton', lang)}
                    </a>
                </div>
            )}

            {!isGenerating && !videoUrl && (
                 <div className={`w-full transition-all duration-300 ${format === 'vertical' ? 'aspect-[9/16] max-h-full' : 'aspect-video'}`}>
                    <div className="w-full h-full flex items-center justify-center">
                         <p className="text-2xl font-bold text-gray-500">{t('previewTitle', lang)}</p>
                    </div>
                 </div>
            )}
        </div>
    );
};

export default React.memo(Preview);