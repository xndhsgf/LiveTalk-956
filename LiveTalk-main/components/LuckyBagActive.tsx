
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Zap, Coins } from 'lucide-react';

interface LuckyBagActiveProps {
  bag: {
    id: string;
    senderName: string;
    totalAmount: number;
    remainingAmount: number;
  };
  onClaim: () => void;
  isClaimed: boolean;
}

const LuckyBagActive: React.FC<LuckyBagActiveProps> = ({ bag, onClaim, isClaimed }) => {
  const [countdown, setCountdown] = useState(10);
  const [status, setStatus] = useState<'waiting' | 'ready'>('waiting');

  useEffect(() => {
    if (isClaimed) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setStatus('ready');
    }
  }, [countdown, isClaimed]);

  if (isClaimed) return null;

  const handleClick = () => {
    if (status === 'ready') {
      onClaim();
    }
  };

  return (
    <motion.div 
      initial={{ scale: 0, opacity: 0, x: 50 }}
      animate={{ scale: 1, opacity: 1, x: 0 }}
      exit={{ scale: 0, opacity: 0, x: 50 }}
      // تم تغيير التموضع ليكون في أسفل اليمين فوق منطقة الأزرار (مكان الدائرة الحمراء)
      className="absolute bottom-24 right-4 z-[120] pointer-events-none"
    >
      <div className="relative pointer-events-auto">
        {/* Glow Effect */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute inset-0 bg-yellow-500 blur-[30px] rounded-full"
        />

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleClick}
          // تم تصغير الحجم قليلاً (w-20 h-20) ليناسب الزاوية السفلية
          className={`relative w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2 shadow-2xl overflow-hidden transition-all duration-500 ${
            status === 'ready' 
              ? 'bg-gradient-to-br from-amber-400 via-yellow-300 to-orange-500 border-white shadow-yellow-500/50' 
              : 'bg-black/80 border-amber-500/40 backdrop-blur-xl'
          }`}
        >
          {status === 'waiting' && (
            <>
              <span className="text-xl mb-0.5">💰</span>
              <span className="text-sm font-black text-amber-500 font-mono tracking-tighter">
                {countdown}s
              </span>
              <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">انتظر</p>
            </>
          )}

          {status === 'ready' && (
            <>
              <motion.div 
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }} 
                transition={{ repeat: Infinity, duration: 0.5 }}
                className="text-3xl mb-0.5 drop-shadow-lg"
              >
                🎁
              </motion.div>
              <span className="text-[7px] font-black text-amber-950 uppercase bg-white/60 px-1.5 py-0.5 rounded-md border border-white/5">
                افتح!
              </span>
              <motion.div 
                animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute inset-0 border-2 border-white rounded-2xl"
              />
            </>
          )}
        </motion.button>

        {/* Sender Info Label - تم وضعه بشكل أنيق بجانب الحقيبة */}
        <div className="absolute -top-6 right-0 whitespace-nowrap bg-black/60 backdrop-blur-md border border-white/10 px-2 py-0.5 rounded-lg shadow-lg flex items-center gap-1.5">
           <Zap size={8} className="text-yellow-400" />
           <span className="text-[7px] font-black text-white/90">من: {bag.senderName}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default LuckyBagActive;
