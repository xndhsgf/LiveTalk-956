
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Star, ShieldCheck } from 'lucide-react';
import { User } from '../../types';

interface RoomParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  participants: User[];
  onSelectUser: (user: User) => void;
}

const RoomParticipantsModal: React.FC<RoomParticipantsModalProps> = ({ isOpen, onClose, participants, onSelectUser }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center pointer-events-none">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" 
      />
      <motion.div 
        initial={{ y: "100%" }} 
        animate={{ y: 0 }} 
        exit={{ y: "100%" }} 
        className="relative w-full max-w-md bg-[#0f172a] rounded-t-[2.5rem] border-t border-white/10 p-6 pb-12 pointer-events-auto shadow-2xl flex flex-col h-[70vh]"
      >
        <div className="flex justify-between items-center mb-6">
           <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white text-right">المتواجدون حالياً</h3>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{participants.length} شخص في الغرفة</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors">
              <X size={20} className="text-slate-400" />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-2 scrollbar-hide" dir="rtl">
           {participants.length === 0 ? (
             <div className="py-20 text-center opacity-30 flex flex-col items-center gap-3">
                <Users size={48} className="text-slate-600" />
                <p className="font-bold text-sm">لا يوجد أحد حالياً</p>
             </div>
           ) : (
             participants.map((user) => (
               <motion.button 
                 key={user.id} 
                 whileTap={{ scale: 0.98 }}
                 onClick={() => { onSelectUser(user); onClose(); }}
                 className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl flex items-center gap-4 transition-all group"
               >
                  <div className="relative shrink-0">
                     <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                        <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                     </div>
                     {user.isVip && (
                        <div className="absolute -top-1 -right-1 bg-amber-500 rounded-lg p-0.5 shadow-lg">
                           <ShieldCheck size={10} className="text-black" />
                        </div>
                     )}
                  </div>

                  <div className="flex-1 text-right min-w-0">
                     <div className="flex items-center gap-2">
                        <span className="font-black text-white text-sm truncate">{user.name}</span>
                        {user.badge && <img src={user.badge} className="h-3 object-contain" />}
                     </div>
                     <p className="text-[9px] text-slate-500 font-bold">ID: {user.customId || user.id}</p>
                  </div>

                  <div className="shrink-0 flex gap-1">
                     <div className="bg-indigo-600/20 px-2 py-1 rounded-lg border border-indigo-500/20 text-indigo-400 text-[8px] font-black uppercase">
                        Lv.{user.wealthLevel || 1}
                     </div>
                  </div>
               </motion.button>
             ))
           )}
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 text-center">
           <p className="text-[8px] text-slate-600 font-bold uppercase tracking-[0.2em]">LiveTalk Intelligent Attendance System</p>
        </div>
      </motion.div>
    </div>
  );
};

export default RoomParticipantsModal;
