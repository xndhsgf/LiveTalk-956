
import React, { useState } from 'react';
import { Search, Settings2, X, Save, ShieldAlert, Trash2, Lock, Unlock, Key, ShieldCheck, Check, UserCog, Hash, Smartphone, Globe, Coins, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, VIPPackage } from '../../types';
import { db } from '../../services/firebase';
import { doc, updateDoc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp, writeBatch } from 'firebase/firestore';

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

  const isRootAdmin = (currentUser as any).email?.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() || currentUser.customId?.toString() === '1';

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.customId?.toString().includes(searchQuery) ||
    u.id.includes(searchQuery)
  );

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (!confirm(`⚠️ تحذير نهائي: هل أنت متأكد من حذف حساب "${selectedUser.name}" بشكل كامل؟`)) return;
    
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', selectedUser.id));
      batch.delete(doc(db, 'rooms', selectedUser.id));
      if (selectedUser.deviceId) batch.delete(doc(db, 'blacklist', 'dev_' + selectedUser.deviceId));
      if (selectedUser.lastIp) batch.delete(doc(db, 'blacklist', 'ip_' + selectedUser.lastIp.replace(/\./g, '_')));
      await batch.commit();
      alert('تم حذف الحساب بنجاح ✅');
      setSelectedUser(null);
    } catch (e) {
      alert('فشل حذف الحساب');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedUser) return;
    try { 
      const updates: any = { 
        coins: Number(editingFields.coins), 
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
            type: 'device', value: selectedUser.deviceId, bannedUserId: selectedUser.id, timestamp: serverTimestamp()
          });
        }
        if (editingFields.banNetwork && selectedUser.lastIp) {
          await setDoc(doc(db, 'blacklist', 'ip_' + selectedUser.lastIp.replace(/\./g, '_')), {
            type: 'ip', value: selectedUser.lastIp, bannedUserId: selectedUser.id, timestamp: serverTimestamp()
          });
        }
      } else {
        if (selectedUser.deviceId) await deleteDoc(doc(db, 'blacklist', 'dev_' + selectedUser.deviceId));
        if (selectedUser.lastIp) await deleteDoc(doc(db, 'blacklist', 'ip_' + selectedUser.lastIp.replace(/\./g, '_')));
      }

      if (isRootAdmin) {
        updates.isSystemModerator = editingFields.isSystemModerator;
        updates.moderatorPermissions = editingFields.moderatorPermissions;
      }

      await onUpdateUser(selectedUser.id, updates); 
      alert('تم التحديث بنجاح ✅'); 
      setSelectedUser(null); 
    } catch (e) { alert('فشل الحفظ'); }
  };

  return (
    <div className="space-y-6 text-right font-cairo pb-10" dir="rtl">
      {/* البحث المطور */}
      <div className="relative w-full">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
          type="text" 
          placeholder="بحث بالاسم أو الـ ID..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-4 pr-12 text-white text-sm outline-none focus:border-blue-500/50 shadow-inner" 
        />
      </div>

      {/* عرض البطاقات للجوال بدلاً من الجدول العريض */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map(u => (
          <motion.div 
            layout
            key={u.id} 
            className={`p-5 rounded-3xl border transition-all ${u.isBanned ? 'bg-red-950/20 border-red-500/30' : 'bg-slate-900/60 border-white/5 hover:border-white/10 shadow-xl'}`}
          >
            <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-3">
                  <div className="relative w-12 h-12">
                     <img src={u.avatar} className="w-full h-full rounded-xl object-cover border border-white/10" />
                     {u.isVip && <div className="absolute -top-1 -right-1 bg-amber-500 text-[6px] font-black p-0.5 rounded-sm">VIP</div>}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-black text-white text-xs truncate max-w-[120px]">{u.name}</span>
                    <span className="text-[9px] text-slate-500 font-bold">ID: {u.customId || u.id}</span>
                  </div>
               </div>
               
               <button 
                  onClick={() => { 
                    setSelectedUser(u); 
                    setEditingFields({ 
                      coins: u.coins || 0, customId: u.customId?.toString() || '',
                      vipLevel: u.vipLevel || 0, isBanned: u.isBanned || false,
                      banUntil: u.banUntil || '', loginPassword: u.loginPassword || '',
                      isSystemModerator: u.isSystemModerator || false,
                      moderatorPermissions: u.moderatorPermissions || [],
                      achievements: u.achievements || [],
                      banDevice: true, banNetwork: true
                    }); 
                  }} 
                  className="p-2.5 bg-blue-600/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all active:scale-90"
                >
                  <Settings2 size={18}/>
               </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-4 border-t border-white/5 pt-4">
               <div className="bg-black/30 p-2 rounded-xl border border-white/5 text-center">
                  <p className="text-[8px] text-slate-500 font-black uppercase mb-1">الرصيد</p>
                  <div className="flex items-center justify-center gap-1">
                     <span className="text-yellow-500 font-black text-[11px] tracking-tight">{(Number(u.coins || 0)).toLocaleString()}</span>
                     <Coins size={10} className="text-yellow-500" />
                  </div>
               </div>
               <div className="bg-black/30 p-2 rounded-xl border border-white/5 text-center flex flex-col items-center justify-center">
                  <p className="text-[8px] text-slate-500 font-black uppercase mb-1">الحالة</p>
                  {u.isBanned ? (
                    <span className="text-red-500 font-black text-[10px] flex items-center gap-1"><ShieldAlert size={10}/> محظور</span>
                  ) : (
                    <span className="text-emerald-500 font-black text-[10px] flex items-center gap-1"><ShieldCheck size={10}/> نشط</span>
                  )}
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[2500] flex items-center justify-center p-2 md:p-4 bg-black/95 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
               <div className="relative h-24 md:h-32 w-full bg-slate-800 shrink-0">
                  <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 p-2 bg-black/40 text-white rounded-full z-10"><X size={20}/></button>
                  <div className="absolute -bottom-8 right-4 md:right-6 flex items-end gap-3 md:gap-4">
                     <img src={selectedUser.avatar} className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl border-4 border-slate-900 shadow-2xl object-cover" />
                     <div className="pb-1 md:pb-2 text-right">
                       <h3 className="font-black text-lg md:text-xl text-white truncate max-w-[180px]">{selectedUser.name}</h3>
                       <p className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest">ID: {selectedUser.customId || '---'}</p>
                     </div>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-5 md:p-8 pt-12 md:pt-14 space-y-6 text-right scrollbar-hide">
                  <div className="p-4 md:p-6 bg-amber-500/5 rounded-3xl border border-amber-500/20 space-y-4">
                    <h4 className="text-xs font-black text-amber-500 flex items-center gap-2">
                       <Hash size={16} /> الهوية والربط
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 pr-2">الآيدي المخصص</label>
                          <input type="text" value={editingFields.customId} onChange={e => setEditingFields({...editingFields, customId: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-black outline-none focus:border-amber-500/50" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-500 pr-2">كلمة سر الدخول</label>
                          <input type="text" value={editingFields.loginPassword} onChange={e => setEditingFields({...editingFields, loginPassword: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-black outline-none focus:border-amber-500/50" />
                       </div>
                    </div>
                  </div>

                  <div className="p-4 md:p-6 bg-red-600/5 rounded-3xl border border-red-600/20 space-y-4">
                    <h4 className="text-xs font-black text-red-500 flex items-center gap-2">
                       <ShieldAlert size={16} /> إدارة العقوبات
                    </h4>
                    <div className="flex gap-2">
                       <button onClick={() => setEditingFields({...editingFields, isBanned: false})} className={`flex-1 py-3.5 rounded-xl text-[9px] font-black border transition-all ${!editingFields.isBanned ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg' : 'bg-black/20 text-slate-500 border-white/5'}`}>فك الحظر</button>
                       <button onClick={() => setEditingFields({...editingFields, isBanned: true})} className={`flex-1 py-3.5 rounded-xl text-[9px] font-black border transition-all ${editingFields.isBanned ? 'bg-red-600 text-white border-red-500 shadow-lg' : 'bg-black/20 text-slate-500 border-white/5'}`}>تطبيق الحظر</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-500">تعديل الكوينز</label>
                        <input type="number" value={editingFields.coins} onChange={e => setEditingFields({...editingFields, coins: parseInt(e.target.value) || 0})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-yellow-500 font-black text-center outline-none" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-500">رتبة الـ VIP</label>
                        <select value={editingFields.vipLevel} onChange={e => setEditingFields({...editingFields, vipLevel: parseInt(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-[10px] font-black outline-none appearance-none cursor-pointer text-center">
                           <option value={0}>بدون</option>
                           {vipLevels.sort((a,b)=>a.level-b.level).map(v => <option key={v.level} value={v.level}>{v.name}</option>)}
                        </select>
                     </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-4 pb-4">
                    <button onClick={handleSave} className="w-full py-4.5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black rounded-2xl shadow-xl active:scale-95 text-xs">حفظ كافة التعديلات</button>
                    <button onClick={handleDeleteUser} disabled={isDeleting} className="w-full py-3 bg-red-600/10 text-red-500 border border-red-500/10 font-black rounded-xl flex items-center justify-center gap-2 active:scale-95 text-[10px]">
                      {isDeleting ? 'جاري الحذف...' : <><Trash2 size={16}/> حذف الحساب نهائياً</>}
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
