import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Sparkles, CreditCard } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { strings } from '../lib/i18n';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

const Pricing = () => {
  const { lang } = useSettingsStore();
  const t = strings[lang] || strings['en'];
  const { user } = useAuthStore();
  


  const [isCheckoutLoading, setIsCheckoutLoading] = React.useState(false);

  const handleCheckout = async () => {
    if (!user) {
      alert('Please login first before upgrading to Pro.');
      return;
    }
    
    if (user.isPro) {
      try {
        setIsCheckoutLoading(true);
        const token = await auth.currentUser.getIdToken(true);
        const response = await fetch('/api/manage-subscription', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await response.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error(data.message || 'Portal linki alınamadı.');
        }
      } catch (error) {
        console.error('Portal error:', error);
        alert(error.message || 'Müşteri portalına erişilemedi. Lütfen e-postanızı kontrol edin.');
      } finally {
        setIsCheckoutLoading(false);
      }
      return;
    }
    
    try {
      setIsCheckoutLoading(true);
      
      // 1. Get Firebase Auth Token securely
      const token = await auth.currentUser.getIdToken(true);
      
      // 2. Call our secure backend to generate a Checkout Session
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create checkout session');
      }
      
      // 3. Redirect user to the secure Polar checkout page
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Could not start checkout process. Please try again.');
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 24 }
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-black text-white py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-6 pb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 to-zinc-500">
            {t.pricingTitle}
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto">
            {t.pricingDesc}
          </p>
          
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Free Plan */}
          <motion.div 
            className="rounded-3xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm p-8 flex flex-col relative overflow-hidden"
            variants={itemVariants}
          >
            <div className="mb-8">
              <h3 className="text-2xl font-semibold mb-2">{t.pricingFree}</h3>
              <p className="text-zinc-400 text-sm h-10">{t.pricingFreeDesc}</p>
            </div>
            
            <div className="mb-8 flex items-baseline">
              <span className="text-5xl font-bold">$0</span>
              <span className="text-zinc-500 ml-2">/{t.pricingMonth}</span>
            </div>

            <ul className="space-y-4 mb-8 flex-grow">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                <span className="text-zinc-300">{t.pricingFeatureFree1}</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                <span className="text-zinc-300">{t.pricingFeatureFree2}</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                <span className="text-zinc-300">{t.pricingFeatureFree3}</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
                <span className="text-zinc-300">{t.pricingFeatureFree4}</span>
              </li>
            </ul>

            <button 
              disabled
              className="w-full py-4 rounded-xl font-medium border border-zinc-700 bg-zinc-800/50 text-zinc-400 cursor-default"
            >
              {t.pricingCurrent}
            </button>
          </motion.div>

          {/* Pro Plan */}
          <motion.div 
            className="rounded-3xl border border-zinc-700 bg-zinc-900/80 backdrop-blur-md p-8 flex flex-col relative overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-purple-900/20"
            variants={itemVariants}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
            
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-2xl font-semibold flex items-center gap-2">
                  {t.pricingPro}
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </h3>
              </div>
              <p className="text-zinc-400 text-sm h-10">{t.pricingProDesc}</p>
            </div>
            
            <div className="mb-8 flex items-baseline">
              <span className="text-5xl font-bold">$9</span>
              <span className="text-zinc-500 ml-2">/{t.pricingMonth}</span>
            </div>

            <ul className="space-y-4 mb-8 flex-grow">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <span className="text-zinc-200">{t.pricingFeaturePro1}</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <span className="text-zinc-200">{t.pricingFeaturePro2}</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <span className="text-zinc-200">{t.pricingFeaturePro3}</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <span className="text-zinc-200">{t.pricingFeaturePro4}</span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                <span className="text-zinc-200">{t.pricingFeaturePro5}</span>
              </li>
            </ul>

            <button 
              onClick={handleCheckout}
              disabled={isCheckoutLoading}
              className="w-full py-4 rounded-xl font-medium bg-white text-black hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CreditCard className="w-4 h-4" />
              {isCheckoutLoading ? 'Loading...' : (user?.isPro ? 'Manage Subscription' : t.pricingUpgrade)}
            </button>
          </motion.div>
        </motion.div>

        <motion.p 
          className="text-center text-zinc-500 text-sm mt-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {t.pricingSubtext}
        </motion.p>
      </div>
    </div>
  );
};

export default Pricing;
