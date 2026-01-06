
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
    if (!confirm(`⚠️ تحذير نهائي: هل أنت متأكد من حذف حساب "${selectedUser.name}" بشكل كامل؟ لا يمكن التراجع عن هذا الإجراء وسيتم مسح كافة البيانات والارتباطات.`)) return;
    
    setIsDeleting(true);
    try {
      const batch = writeBatch(db);
      
      // 1. حذف وثيقة المستخدم
      batch.delete(doc(db, 'users', selectedUser.id));
      
      // 2. حذف غرفة المستخدم إن وجدت
      batch.delete(doc(db, 'rooms', selectedUser.id));
      
      // 3. مسح بيانات البند إن وجدت
      if (selectedUser.deviceId) batch.delete(doc(db, 'blacklist', 'dev_' + selectedUser.deviceId));
      if (selectedUser.lastIp) batch.delete(doc(db, 'blacklist', 'ip_' + selectedUser.lastIp.replace(/\./g, '_')));

      await batch.commit();
      alert('تم حذف الحساب وكافة بياناته بنجاح ✅');
      setSelectedUser(null);
    } catch (e) {
      alert('فشل حذف الحساب، حاول مجدداً');
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
        const q = query(collection(db, 'blacklist'), where('bannedUserId', '==', selectedUser.id));
        const qSnap = await getDocs(q);
        for (const d of qSnap.docs) { await deleteDoc(d.ref); }
      }

      if (isRootAdmin) {
        updates.isSystemModerator = editingFields.isSystemModerator;
        updates.moderatorPermissions = editingFields.moderatorPermissions;
      }

      await onUpdateUser(selectedUser.id, updates); 

      if (editingFields.customId !== selectedUser.customId) {
        const roomRef = doc(db, 'rooms', selectedUser.id);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
          await updateDoc(roomRef, { hostCustomId: editingFields.customId });
        }
      }

      alert('تم تحديث بيانات العضو بنجاح ✅'); 
      setSelectedUser(null); 
    } catch (e) { 
      alert('فشل الحفظ، تأكد من صلاحيات الإنترنت'); 
    }
  };

  return (
    <div className="space-y-6 text-right font-cairo" dir="rtl">
      <div className="relative max-w-md">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input 
          type="text" 
          placeholder="بحث بالاسم أو الـ ID..." 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
          className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-4 pr-12 text-white text-sm outline-none focus:border-blue-500/50 transition-all" 
        />
      </div>

      <div className="bg-slate-950/40 rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
        <table className="w-full text-right text-xs">
          <thead className="bg-black/40 text-slate-500 font-black border-b border-white/5">
            <tr>
              <th className="p-5">المستخدم</th>
              <th className="p-5 text-center">الرصيد</th>
              <th className="p-5 text-center">الحالة</th>
              <th className="p-5 text-center">الإدارة</th>
              <th className="p-5 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredUsers.map(u => (
              <tr key={u.id} className={`${u.isBanned ? 'bg-red-950/20' : 'hover:bg-white/5'} transition-colors`}>
                <td className="p-5 flex items-center gap-3">
                  <img src={u.avatar} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
                  <div className="flex flex-col">
                    <span className="font-bold text-white">{u.name}</span>
                    <span className="text-[9px] text-slate-500">ID: {u.customId || u.id}</span>
                  </div>
                </td>
                <td className="p-5 text-center">
                  <div className="flex items-center justify-center gap-1 bg-yellow-500/10 py-1 px-2 rounded-lg border border-yellow-500/20 w-fit mx-auto">
                    <span className="text-yellow-500 font-black">{(Number(u.coins || 0)).toLocaleString()}</span>
                    <Coins size={10} className="text-yellow-500" />
                  </div>
                </td>
                <td className="p-5 text-center">
                  {u.isBanned ? <span className="text-red-500 font-black">محظور</span> : <span className="text-emerald-500 font-black">نشط</span>}
                </td>
                <td className="p-5 text-center">
                  {u.isSystemModerator ? <span className="text-blue-400 font-black">مشرف</span> : <span className="text-slate-700">---</span>}
                </td>
                <td className="p-5 text-center">
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
                    className="p-2.5 bg-blue-600/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                  >
                    <Settings2 size={16}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
               <div className="relative h-32 w-full bg-slate-800">
                  <button onClick={() => setSelectedUser(null)} className="absolute top-4 right-4 p-2 bg-black/40 text-white rounded-full"><X size={20}/></button>
                  <div className="absolute -bottom-10 right-6 flex items-end gap-4">
                     <img src={selectedUser.avatar} className="w-20 h-20 rounded-3xl border-4 border-slate-900 shadow-2xl object-cover" />
                     <div className="pb-2 text-right">
                       <h3 className="font-black text-xl text-white">{selectedUser.name}</h3>
                       <p className="text-[10px] text-slate-500 font-bold">ID الأصل: {selectedUser.id}</p>
                     </div>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto p-8 pt-14 space-y-8 text-right">
                  <div className="p-6 bg-amber-500/5 rounded-3xl border border-amber-500/20 space-y-5">
                    <h4 className="text-sm font-black text-amber-500 flex items-center gap-2">
                       <Hash size={18} /> هوية الحساب والربط المخصص
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 pr-2">رقم الآيدي الظاهر</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={editingFields.customId} 
                              onChange={e => setEditingFields({...editingFields, customId: e.target.value})} 
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-black outline-none focus:border-amber-500/50"
                              placeholder="ID جديد..."
                            />
                            <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                          </div>
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-500 pr-2">كلمة مرور الربط (ID Login)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={editingFields.loginPassword} 
                              onChange={e => setEditingFields({...editingFields, loginPassword: e.target.value})} 
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-white text-xs font-black outline-none focus:border-amber-500/50"
                              placeholder="تعيين كلمة سر..."
                            />
                            <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                          </div>
                       </div>
                    </div>
                  </div>

                  <div className="p-6 bg-red-600/5 rounded-3xl border border-red-600/20 space-y-4">
                    <h4 className="text-sm font-black text-red-500 flex items-center gap-2">
                       <ShieldAlert size={18} /> إدارة الحظر والشبكة
                    </h4>
                    <div className="flex gap-3">
                       <button 
                         onClick={() => setEditingFields({...editingFields, banDevice: !editingFields.banDevice})}
                         className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black transition-all ${editingFields.banDevice ? 'bg-red-600/20 border-red-600 text-white' : 'bg-black/40 border-white/5 text-slate-500'}`}
                       >
                          <Smartphone size={14} /> بند فون
                       </button>
                       <button 
                         onClick={() => setEditingFields({...editingFields, banNetwork: !editingFields.banNetwork})}
                         className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black transition-all ${editingFields.banNetwork ? 'bg-blue-600/20 border-blue-600 text-white' : 'bg-black/40 border-white/5 text-slate-500'}`}
                       >
                          <Globe size={14} /> بند شبكة
                       </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                       <button onClick={() => setEditingFields({...editingFields, isBanned: false})} className={`py-3 rounded-xl text-[10px] font-black border transition-all ${!editingFields.isBanned ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-black/20 text-slate-500 border-white/5'}`}>فك الحظر</button>
                       <button onClick={() => setEditingFields({...editingFields, isBanned: true, banUntil: 'permanent'})} className={`py-3 rounded-xl text-[10px] font-black border transition-all ${editingFields.isBanned ? 'bg-red-600 text-white border-red-500' : 'bg-black/20 text-slate-500 border-white/5'}`}>حظر دائم</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500">الكوينز 🪙</label>
                        <input type="number" value={editingFields.coins} onChange={e => setEditingFields({...editingFields, coins: parseInt(e.target.value) || 0})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-yellow-500 font-black text-center outline-none" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-500">الـ VIP 👑</label>
                        <select value={editingFields.vipLevel} onChange={e => setEditingFields({...editingFields, vipLevel: parseInt(e.target.value)})} className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-xs font-black outline-none appearance-none cursor-pointer text-center">
                           <option value={0}>بدون</option>
                           {vipLevels.sort((a,b)=>a.level-b.level).map(v => <option key={v.level} value={v.level}>{v.name}</option>)}
                        </select>
                     </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-6">
                    <button onClick={handleSave} className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all text-sm uppercase tracking-wider">حفظ كافة التعديلات</button>
                    
                    <button 
                      onClick={handleDeleteUser} 
                      disabled={isDeleting}
                      className="w-full py-4 bg-red-600/10 text-red-500 border border-red-500/20 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all text-xs"
                    >
                      {isDeleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><Trash2 size={16}/> حذف الحساب نهائياً</>}
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
