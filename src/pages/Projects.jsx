import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useNavigate } from 'react-router-dom';
import { Layers, Clock, ArrowRight, Video, Trash2 } from 'lucide-react';
import { t } from '../lib/i18n';

const Projects = () => {
  const { user, loading, projects, projectsLoading, deleteProject } = useAuthStore();
  const lang = useSettingsStore(state => state.lang);
  const navigate = useNavigate();
  const [deletingId, setDeletingId] = React.useState(null);

  useEffect(() => {
    // If auth state is resolved and no user, redirect home
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="w-full flex-grow bg-bg-base flex justify-center items-center min-h-screen">
        <div className="w-10 h-10 border-4 border-zinc-800 border-t-accent-gold rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="w-full flex-grow bg-bg-base text-text-primary p-6 pt-24 md:p-12 md:pt-32 min-h-screen">
      <div className="max-w-[1280px] mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-display font-extrabold text-white mb-4">
            {t('myProjects', lang) || "Projelerim"}
          </h1>
          <p className="text-text-muted text-lg">
            {t('projectsDesc', lang) || "Geçmişte ürettiğiniz tüm videoların taslakları burada güvenle saklanır."}
          </p>
        </div>

        {projectsLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-zinc-800 border-t-accent-gold rounded-full animate-spin"></div>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-surface border border-border-color rounded-2xl">
            <Video size={48} className="text-zinc-600 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">{t('noProjectsTitle', lang) || "Henüz projeniz yok"}</h3>
            <p className="text-text-muted mb-6">{t('noProjectsDesc', lang) || "Yeni bir video oluşturarak hemen başlayın."}</p>
            <button onClick={() => navigate('/tools')} className="px-6 py-3 bg-accent-gold text-black font-bold rounded-full hover:bg-yellow-400 transition-colors cursor-pointer">
              {t('goToTools', lang) || "Araçlara Git"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj, idx) => (
              <motion.div
                key={proj.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                onClick={() => {
                  // Geçmiş taslağı localStorage'a atıp yönlendiriyoruz
                  localStorage.setItem('draft_project', JSON.stringify({
                    id: proj.id,
                    projectName: proj.settings?.projectName || '',
                    ...proj.settings
                  }));
                  if (proj.toolId && proj.toolId !== 'match-cut' && proj.toolId !== 'text-match-cut') {
                    navigate(`/effects/${proj.toolId}?draft=${proj.id}`);
                  } else {
                    navigate('/match-cut?draft=' + proj.id);
                  }
                }}
                className="group bg-surface border border-border-color hover:border-accent-gold/50 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-[0_0_20px_rgba(245,179,1,0.1)] flex flex-col"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-zinc-900 rounded-lg flex items-center justify-center text-accent-gold">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-accent-gold transition-colors">
                      {proj.settings?.projectName || proj.settings?.phrase || t('untitledProject', lang)}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-text-muted mt-1">
                      <Clock size={12} /> 
                      {proj.updatedAt?.toDate ? new Date(proj.updatedAt.toDate()).toLocaleDateString() : t('justNow', lang)}
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      const confirmText = t('deleteProjectConfirm', lang);
                      if (window.confirm(confirmText)) {
                        setDeletingId(proj.id);
                        deleteProject(proj.id).finally(() => setDeletingId(null));
                      }
                    }}
                    disabled={deletingId === proj.id}
                    className="ml-auto p-2 text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title={t('deleteProject', lang)}
                  >
                    {deletingId === proj.id ? (
                      <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
                
                <div className="mt-auto pt-4 border-t border-border-color flex justify-between items-center text-sm">
                  <span className="text-zinc-400 font-mono text-xs px-2 py-0.5 bg-zinc-800 rounded border border-zinc-700 uppercase">
                    {proj.toolId === 'match-cut' || !proj.toolId ? 'Match Cut' : proj.toolId.replace('-', ' ')}
                  </span>
                  <div className="flex items-center gap-1 text-accent-gold font-bold opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0">
                    {t('openProject', lang)} <ArrowRight size={16} />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Projects;
