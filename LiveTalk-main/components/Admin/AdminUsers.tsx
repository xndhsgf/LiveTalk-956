
import React, { useState } from 'react';
import { Search, Settings2, X, Save, ShieldAlert, Trash2, Lock, Unlock, Key, ShieldCheck, Check, UserCog, Hash, Smartphone, Globe, Coins, AlertTriangle, Crown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, VIPPackage } from '../../types';
import { db } from '../../services/firebase';
import { doc, updateDoc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp, writeBatch, increment } from 'firebase/firestore';

interface AdminUsersProps {
  users: User[];
  vipLevels: VIPPackage[];
  onUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
  currentUser: User;
}

const ROOT_ADMIN_EMAIL = 'admin-owner@livetalk.com';

const AdminUsers: React.FC<AdminUsersProps> = ({ users, vipLevels, onUpdateUser, currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingFields, setEditingFields] = useState({ 
    coins: 0, 
    customId: '', 
    vipLevel: 0, 
    isBanned: false, 
    banUntil: '',
    banDevice: true,
    banNetwork: true,
    loginPassword: '',
    isSystemModerator: false,
    moderatorPermissions: [] as string[],
    achievements: [] as string[]
  });

  const isOwner = currentUser.email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() || currentUser.customId?.toString() === '1';

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.customId?.toString().includes(searchQuery) ||
    u.id.includes(searchQuery)
  );

  const handleSave = async () => {
    if (!selectedUser) return;
    
    const targetIsOwner = selectedUser.email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() || selectedUser.customId?.toString() === '1';
    if (targetIsOwner && !isOwner) {
       alert('⚠️ غير مسموح لك بتعديل بيانات المدير العام!');
       return;
    }

    try { 
      const targetCoins = Number(editingFields.coins);
      
      const updates: any = { 
        coins: targetCoins, 
        customId: editingFields.customId.trim(),
        isBanned: editingFields.isBanned, 
        banUntil: editingFields.banUntil,
        vipLevel: editingFields.vipLevel,
        isVip: editingFields.vipLevel > 0,
        loginPassword: editingFields.loginPassword.trim() || null,
        achievements: editingFields.achievements.slice(0, 30)
      }; 

      if (editingFields.isBanned) {
        if (editingFields.banDevice && selectedUser.deviceId) {
          await setDoc(doc(db, 'blacklist', 'dev_' + selectedUser.deviceId), {
            type: 'device',
            value: selectedUser.deviceId,
            bannedUserId: selectedUser.id,
            timestamp: serverTimestamp()
          });
        }
        if (editingFields.banNetwork && selectedUser.lastIp) {
          await setDoc(doc(db, 'blacklist', 'ip_' + selectedUser.lastIp.replace(/\./g, '_')), {
            type: 'ip',
            value: selectedUser.lastIp,
            bannedUserId: selectedUser.id,
            timestamp: serverTimestamp()
          });
        }
      } else {
        if (selectedUser.deviceId) await deleteDoc(doc(db, 'blacklist', 'dev_' + selectedUser.deviceId));
        if (selectedUser.lastIp) await deleteDoc(doc(db, 'blacklist', 'ip_' + selectedUser.lastIp.replace(/\./g, '_')));
      }

      if (isOwner) {
        updates.isSystemModerator = editingFields.isSystemModerator;
        updates.moderatorPermissions = editingFields.moderatorPermissions;
      }

      await updateDoc(doc(db, 'users', selectedUser.id), updates);
      alert('تم تحديث بيانات المستخدم وصلاحياته بنجاح ✅'); 
      setSelectedUser(null); 
    } catch (e) { 
      alert('فشل الحفظ في قاعدة البيانات'); 
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    const targetIsOwner = selectedUser.email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() || selectedUser.customId?.toString() === '1';
    if (targetIsOwner) return alert('⚠️ لا يمكن حذف حساب المدير العام!');

    if (!confirm(`⚠️ تحذير نهائي: هل أنت متأكد من حذف حساب "${selectedUser.name}" بشكل كامل؟ لا يمكن التراجع!`)) return;
    
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', selectedUser.id));
      batch.delete(doc(db, 'rooms', selectedUser.id)); 
      await batch.commit();
      alert('تم حذف الحساب نهائياً من السيستم ✅');
      setSelectedUser(null);
    } catch (e) {
      alert('فشل حذف الحساب');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 text-right font-cairo pb-6" dir="rtl">
      <div className="relative w-full">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
        <input 
          type="text" 
          placeholder="بحث بالاسم أو الـ ID..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pr-10 text-white text-xs outline-none focus:border-blue-500/50" 
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredUsers.map(u => {
          const targetIsOwner = u.email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() || u.customId?.toString() === '1';
          const canEditThisUser = isOwner || !targetIsOwner;

          return (
            <motion.div 
              layout
              key={u.id} 
              className={`p-3 rounded-2xl border transition-all ${u.isBanned ? 'bg-red-950/20 border-red-500/30' : 'bg-slate-900/60 border-white/5 shadow-lg'}`}
            >
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <div className="relative w-10 h-10">
                       <img src={u.avatar} className="w-full h-full rounded-lg object-cover border border-white/10" />
                       {u.isVip && <div className="absolute -top-1 -right-1 bg-amber-500 text-[5px] font-black p-0.5 rounded-sm">VIP</div>}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={`font-black text-[11px] truncate max-w-[100px] ${targetIsOwner ? 'text-red-400' : 'text-white'}`}>
                        {u.name} {targetIsOwner && '👑'}
                      </span>
                      <span className="text-[8px] text-slate-500 font-bold uppercase">ID: {u.customId || u.id}</span>
                    </div>
                 </div>
                 
                 {canEditThisUser ? (
                    <button 
                      onClick={() => { 
                        setSelectedUser(u); 
                        setEditingFields({ 
                          coins: Number(u.coins) || 0, customId: u.customId?.toString() || '',
                          vipLevel: u.vipLevel || 0, isBanned: u.isBanned || false,
                          banUntil: u.banUntil || '', loginPassword: u.loginPassword || '',
                          isSystemModerator: u.isSystemModerator || false,
                          moderatorPermissions: u.moderatorPermissions || [],
                          achievements: u.achievements || [],
                          banDevice: true, banNetwork: true
                        }); 
                      }} 
                      className="p-2 bg-blue-600/10 text-blue-400 rounded-lg hover:bg-blue-600 hover:text-white active:scale-90 transition-all"
                    >
                      <Settings2 size={16}/>
                    </button>
                 ) : (
                    <div className="p-2 bg-slate-800/50 text-slate-600 rounded-lg"><Lock size={16} /></div>
                 )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[2500] flex items-center justify-center p-3 bg-black/95 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
               {/* Modal Header - Compact */}
               <div className="relative h-20 w-full bg-slate-800 shrink-0">
                  <button onClick={() => setSelectedUser(null)} className="absolute top-3 right-3 p-1.5 bg-black/40 text-white rounded-full z-10"><X size={16}/></button>
                  <div className="absolute -bottom-6 right-4 flex items-end gap-3">
                     <img src={selectedUser.avatar} className="w-14 h-14 rounded-xl border-4 border-slate-900 shadow-xl object-cover" />
                     <div className="pb-1 text-right">
                       <h3 className="font-black text-sm text-white truncate max-w-[140px]">{selectedUser.name}</h3>
                       <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest">ID: {selectedUser.customId || '---'}</p>
                     </div>
                  </div>
               </div>

               {/* Modal Body - Slim */}
               <div className="flex-1 overflow-y-auto p-5 pt-10 space-y-4 text-right scrollbar-hide">
                  
                  {/* Section 1: Identity */}
                  <div className="p-3 bg-amber-500/5 rounded-2xl border border-amber-500/10 space-y-3">
                    <h4 className="text-[10px] font-black text-amber-500 flex items-center gap-1.5"><Hash size={12} /> الهوية والربط</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 pr-1">تعديل الـ ID</label>
                          <input type="text" value={editingFields.customId} onChange={e => setEditingFields({...editingFields, customId: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-lg p-2 text-white text-[10px] font-black outline-none focus:border-amber-500/50" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-500 pr-1">كلمة السر</label>
                          <input type="text" value={editingFields.loginPassword} onChange={e => setEditingFields({...editingFields, loginPassword: e.target.value})} className="w-full bg-black/40 border border-white/5 rounded-lg p-2 text-white text-[10px] font-black outline-none focus:border-amber-500/50" />
                        </div>
                    </div>
                  </div>

                  {/* Section 2: Economy */}
                  <div className="grid grid-cols-2 gap-3">
                     <div className="p-3 bg-yellow-500/5 rounded-2xl border border-yellow-500/10 space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 flex items-center gap-1"><Coins size={10}/> كوينزات</label>
                        <input type="number" value={editingFields.coins} onChange={e => setEditingFields({...editingFields, coins: parseInt(e.target.value) || 0})} className="w-full bg-black/40 border border-white/5 rounded-lg p-2 text-yellow-500 font-black text-center text-[10px] outline-none" />
                     </div>
                     <div className="p-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 space-y-1.5">
                        <label className="text-[8px] font-black text-slate-500 flex items-center gap-1"><Crown size={10}/> VIP</label>
                        <select value={editingFields.vipLevel} onChange={e => setEditingFields({...editingFields, vipLevel: parseInt(e.target.value)})} className="w-full bg-black/40 border border-white/5 rounded-lg p-2 text-white text-[9px] font-black outline-none appearance-none cursor-pointer">
                           <option value={0}>إلغاء</option>
                           {vipLevels.sort((a,b)=>a.level-b.level).map(v => <option key={v.level} value={v.level}>{v.name}</option>)}
                        </select>
                     </div>
                  </div>

                  {/* Section 3: Banning */}
                  <div className="p-3 bg-red-600/5 rounded-2xl border border-red-600/10 space-y-3">
                    <h4 className="text-[10px] font-black text-red-500 flex items-center gap-1.5"><ShieldAlert size={12} /> الحظر الأبدي</h4>
                    <div className="flex gap-2">
                       <button onClick={() => setEditingFields({...editingFields, isBanned: false})} className={`flex-1 py-2 rounded-lg text-[9px] font-black border transition-all ${!editingFields.isBanned ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-black/20 text-slate-500 border-white/5'}`}>فك</button>
                       <button onClick={() => setEditingFields({...editingFields, isBanned: true})} className={`flex-1 py-2 rounded-lg text-[9px] font-black border transition-all ${editingFields.isBanned ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-900/40' : 'bg-black/20 text-slate-500 border-white/5'}`}>حظر</button>
                    </div>

                    {editingFields.isBanned && (
                      <div className="grid grid-cols-2 gap-2">
                         <button 
                           onClick={() => setEditingFields({...editingFields, banDevice: !editingFields.banDevice})}
                           className={`p-2 rounded-lg border flex items-center justify-center gap-1 text-[7px] font-black transition-all ${editingFields.banDevice ? 'bg-red-600/20 border-red-500 text-red-400' : 'bg-black/20 border-white/5 text-slate-600'}`}
                         >
                            <Smartphone size={12}/> {editingFields.banDevice ? 'فون' : 'تجاهل'}
                         </button>
                         <button 
                           onClick={() => setEditingFields({...editingFields, banNetwork: !editingFields.banNetwork})}
                           className={`p-2 rounded-lg border flex items-center justify-center gap-1 text-[7px] font-black transition-all ${editingFields.banNetwork ? 'bg-red-600/20 border-red-500 text-red-400' : 'bg-black/20 border-white/5 text-slate-600'}`}
                         >
                            <Globe size={12}/> {editingFields.banNetwork ? 'شبكة' : 'تجاهل'}
                         </button>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex flex-col gap-2 pt-2 pb-2">
                    <button onClick={handleSave} className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black rounded-xl shadow-lg active:scale-95 text-[11px]">حفظ التعديلات</button>
                    <button onClick={handleDeleteUser} disabled={isDeleting} className="w-full py-2 text-red-500 font-black text-[9px] opacity-40 hover:opacity-100 flex items-center justify-center gap-1">
                      <Trash2 size={12}/> {isDeleting ? 'جاري...' : 'حذف الحساب نهائياً'}
                    </button>
                  </div>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminUsers;
