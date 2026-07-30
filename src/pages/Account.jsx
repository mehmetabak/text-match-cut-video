import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { useNavigate } from 'react-router-dom';
import { User, CreditCard, Activity, Check, LogOut, Play, Gift, Sparkles } from 'lucide-react';
import { t } from '../lib/i18n';
import RewardAdModal from '../components/monetization/RewardAdModal';
import { auth } from '../lib/firebase';

const Account = () => {
  const user = useAuthStore(state => state.user);
  const loading = useAuthStore(state => state.loading);
  const logout = useAuthStore(state => state.logout);
  const earnRewardPoints = useAuthStore(state => state.earnRewardPoints);
  const setRewardModalOpen = useAuthStore(state => state.setRewardModalOpen);
  const lang = useSettingsStore(state => state.lang);
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('account');
  const [rewardError, setRewardError] = useState('');
  
  // Backward compatibility state for UI button
  const [isWatchingAd, setIsWatchingAd] = useState(false);

  const [isPortalLoading, setIsPortalLoading] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const [isVerifyingCheckout, setIsVerifyingCheckout] = useState(false);
  const [checkoutVerified, setCheckoutVerified] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const payment = urlParams.get('payment');
    const checkoutId = urlParams.get('checkout_id');

    if (payment === 'success' && checkoutId && user && !checkoutVerified && !isVerifyingCheckout) {
      const verifyCheckout = async () => {
        try {
          setIsVerifyingCheckout(true);
          const token = await auth.currentUser.getIdToken(true);
          const response = await fetch('/api/verify-checkout', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ checkoutId })
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.isPro) {
              // Update local state immediately for fast UX
              useAuthStore.setState({ user: { ...user, isPro: true } });
              setCheckoutVerified(true);
              
              // Clean up URL
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        } catch (error) {
          console.error("Error verifying checkout immediately:", error);
        } finally {
          setIsVerifyingCheckout(false);
        }
      };
      
      verifyCheckout();
    }
  }, [user, checkoutVerified, isVerifyingCheckout]);

  if (loading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="w-12 h-12 border-4 border-accent-gold border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const memberSinceDate = user.createdAt?.toDate 
    ? new Date(user.createdAt.toDate()).toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' }) 
    : new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const tabs = [
    { id: 'account', label: t('accountTab', lang), icon: <User size={18} /> },
    { id: 'billing', label: t('billingTab', lang), icon: <CreditCard size={18} /> },
    { id: 'activity', label: t('activityTab', lang), icon: <Activity size={18} /> }
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleWatchAdClick = () => {
    setRewardError('');
    setRewardModalOpen(true);
  };


  const handleManageSubscription = async () => {
    try {
      setIsPortalLoading(true);
      const token = await auth.currentUser.getIdToken(true);
      const response = await fetch('/api/manage-subscription', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert("Server returned: " + JSON.stringify(data, null, 2));
        throw new Error(data.error || data.message || 'Portal linki alınamadı.');
      }
    } catch (error) {
      console.error('Portal error:', error);
      alert(error.message || 'Müşteri portalına erişilemedi. Lütfen e-postanızı kontrol edin.');
    } finally {
      setIsPortalLoading(false);
    }
  };

  const handleRewardEarned = (points) => {
    earnRewardPoints(points).then((res) => {
      if (res.success) {
        // UI updates can go here if needed
      } else {
        setRewardError(res.message);
      }
    });
  };

  // Modern container variants
  const containerVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, staggerChildren: 0.1 } },
    exit: { opacity: 0, scale: 0.98, transition: { duration: 0.3 } }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8 relative z-10 flex flex-col h-full mt-2 sm:mt-6">
      
      {/* Background glow elements */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent-gold/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent-gold/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="flex flex-col md:flex-row gap-6 relative h-full">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex-shrink-0 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible custom-scrollbar pb-2 md:pb-0 h-auto md:h-full">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-sm sm:text-base relative whitespace-nowrap overflow-hidden group ${
                activeTab === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {/* Active Tab Background */}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="active-tab-bg"
                  className="absolute inset-0 bg-white/5 border border-white/10 rounded-2xl"
                  initial={false}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-3">
                {tab.icon}
                {tab.label}
              </span>
            </button>
          ))}
          
          <div className="hidden md:block w-full h-px bg-zinc-800/50 my-4"></div>
          
          <button 
            onClick={handleLogout}
            className="hidden md:flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all font-medium text-red-500/80 hover:text-red-400 hover:bg-red-500/10 text-sm sm:text-base whitespace-nowrap"
          >
            <LogOut size={18} />
            {t('signOut', lang)}
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-zinc-950/40 backdrop-blur-3xl border border-zinc-800/60 rounded-[2rem] p-5 sm:p-8 shadow-2xl relative min-h-[400px] md:h-full overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            
            {/* ACCOUNT TAB */}
            {activeTab === 'account' && (
              <motion.div
                key="account"
                variants={containerVariants}
                initial={false}
                animate="visible"
                exit="exit"
                className="flex flex-col gap-8 h-full"
              >
                {/* Profile Header */}
                <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-accent-gold/20 rounded-full blur-xl group-hover:bg-accent-gold/30 transition-all"></div>
                    {user.photoURL ? (
                      <img width="112" height="112" src={user.photoURL} referrerPolicy="no-referrer" alt="Profile" className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-zinc-700/50 shadow-2xl relative z-10 object-cover" />
                    ) : (
                      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 text-white flex items-center justify-center font-bold text-4xl border-2 border-zinc-700/50 shadow-2xl relative z-10">
                        {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col pt-2">
                    <h2 className="text-3xl font-black text-white tracking-tight">{user.displayName}</h2>
                    <p className="text-zinc-400 text-base mt-1">{user.email}</p>
                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                      <span className="bg-zinc-800/80 text-zinc-300 text-xs px-3 py-1 rounded-full font-medium border border-zinc-700/50">
                        {t('memberSince', lang)} {memberSinceDate}
                      </span>
                    </div>
                  </div>
                </motion.div>

                {/* Info Cards Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Pro Plan Card */}
                  <motion.div variants={itemVariants} className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-[1.5rem] p-6 relative overflow-hidden group hover:border-zinc-700 transition-colors">
                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-accent-gold/10 rounded-full blur-3xl group-hover:bg-accent-gold/20 transition-all"></div>
                    
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <Sparkles size={20} className="text-accent-gold" />
                          {t('proMonthly', lang)}
                        </h3>
                        <p className={user.isPro ? "text-green-500 text-sm mt-1 font-medium" : "text-zinc-500 text-sm mt-1"}>
                          {user.isPro ? t('active', lang) : t('inactive', lang)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-8 relative z-10">
                      {[t('creditsEachMonth', lang), t('fullHdExports', lang), t('fastExportServers', lang), t('creditsRollOver', lang)].map((perk, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                          <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <Check size={12} className="text-accent-gold" />
                          </div>
                          {perk}
                        </div>
                      ))}
                    </div>

                    <button 
                      onClick={() => user.isPro ? handleManageSubscription() : navigate('/pricing')}
                      disabled={isPortalLoading}
                      className={`w-full font-medium py-3 rounded-xl transition-all border relative z-10 ${user.isPro ? 'bg-white text-black hover:bg-zinc-200 border-white' : 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700 hover:border-zinc-600'} disabled:opacity-50`}>
                      {isPortalLoading ? 'Loading...' : (user.isPro ? t('manageSubscription', lang) : t('subscribe', lang))}
                    </button>
                  </motion.div>

                  {/* Rewards Card */}
                  <motion.div variants={itemVariants} className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-[1.5rem] p-6 relative overflow-hidden group hover:border-zinc-700 transition-colors flex flex-col">
                    <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-accent-gold/10 rounded-full blur-3xl group-hover:bg-accent-gold/20 transition-all"></div>
                    
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <Gift size={20} className="text-accent-gold" />
                          {t('earnRewardsTitle', lang) || "Earn Points"}
                        </h3>
                      </div>
                      <div className="bg-accent-gold/10 border border-accent-gold/20 text-accent-gold px-4 py-1.5 rounded-full font-bold text-sm shadow-[0_0_15px_rgba(245,179,1,0.1)]">
                        {user.adRewardPoints || 0} {t('rewardPoints', lang)}
                      </div>
                    </div>
                    
                    <p className="text-zinc-400 text-sm leading-relaxed mb-6 flex-1">
                      {t('earnRewardsDesc', lang) || "Watch a short ad to earn points. Use these points to unlock premium features and fast rendering."}
                    </p>

                    <button 
                      onClick={handleWatchAdClick}
                      disabled={isWatchingAd}
                      className="w-full bg-[#F5B301] hover:bg-yellow-400 text-black disabled:bg-[#F5B301]/50 disabled:cursor-wait font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(245,179,1,0.3)] hover:shadow-[0_0_30px_rgba(245,179,1,0.5)] flex items-center justify-center gap-2 relative z-10"
                    >
                      <Play size={18} fill="currentColor" />
                      {t('watchAdButton', lang) || "Watch Ad & Earn Points"}
                    </button>
                    
                    {rewardError && (
                      <motion.p 
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center text-red-400 text-xs font-medium mt-3 bg-red-500/10 py-1.5 rounded-lg border border-red-500/20"
                      >
                        {rewardError}
                      </motion.p>
                    )}
                  </motion.div>

                </div>
                
                {/* Mobile Logout */}
                <div className="md:hidden mt-4">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 font-medium"
                  >
                    <LogOut size={18} />
                    {t('signOut', lang)}
                  </button>
                </div>
              </motion.div>
            )}

            {/* BILLING & CREDITS TAB */}
            {activeTab === 'billing' && (
              <motion.div
                key="billing"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex flex-col items-center justify-center h-full min-h-[400px] text-center"
              >
                <motion.div variants={itemVariants} className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6">
                  <CreditCard size={32} className={user.isPro ? "text-purple-400" : "text-zinc-500"} />
                </motion.div>
                <motion.h3 variants={itemVariants} className="text-2xl font-bold text-white mb-2">{t('billingTab', lang)}</motion.h3>
                <motion.p variants={itemVariants} className="text-zinc-400 max-w-sm mb-8">
                  {user.isPro 
                    ? t('billingProDesc', lang)
                    : t('billingFreeDesc', lang)}
                </motion.p>
                
                <motion.button 
                  variants={itemVariants} 
                  onClick={() => user.isPro ? handleManageSubscription() : navigate('/pricing')}
                  disabled={isPortalLoading}
                  className={`px-8 py-3 rounded-xl font-bold transition-all shadow-lg flex items-center gap-2 ${user.isPro ? 'bg-white text-black hover:bg-zinc-200' : 'bg-[#F5B301] text-black hover:bg-yellow-400'} disabled:opacity-50`}
                >
                  <CreditCard size={18} />
                  {isPortalLoading ? 'Loading...' : (user.isPro ? t('manageSubscription', lang) : t('pricingUpgrade', lang))}
                </motion.button>
              </motion.div>
            )}

            {/* ACTIVITY TAB */}
            {activeTab === 'activity' && (
              <motion.div
                key="activity"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex flex-col items-center justify-center h-full min-h-[400px] text-center"
              >
                <motion.div variants={itemVariants} className="w-20 h-20 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6">
                  <Activity size={32} className="text-zinc-500" />
                </motion.div>
                <motion.h3 variants={itemVariants} className="text-2xl font-bold text-white mb-2">{t('activityTab', lang)}</motion.h3>
                <motion.p variants={itemVariants} className="text-zinc-400 max-w-sm mb-6">
                  View your past video generations, logins, and complete account activity history.
                </motion.p>
                <motion.span variants={itemVariants} className="text-xs font-bold uppercase tracking-widest text-accent-gold bg-accent-gold/10 border border-accent-gold/20 px-4 py-2 rounded-full shadow-[0_0_20px_rgba(245,179,1,0.1)]">
                  Coming Soon
                </motion.span>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Account;
