
import React, { useState } from 'react';
import { Eraser, AlertTriangle, ShieldAlert, RotateCcw, UserMinus, RefreshCw, Trash2, History, DatabaseBackup, Globe, Smartphone } from 'lucide-react';
import { db } from '../../services/firebase';
import { collection, getDocs, writeBatch, doc, deleteDoc } from 'firebase/firestore';
import { DEFAULT_GIFTS, DEFAULT_STORE_ITEMS, DEFAULT_VIP_LEVELS } from '../../constants';

const AdminMaintenance: React.FC<any> = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState('');

  const handleRestoreSystemData = async () => {
    if (!confirm('هل تريد استعادة البيانات الافتراضية؟')) return;
    setIsProcessing(true);
    setProcessStatus('جاري استعادة البيانات...');
    try {
      const batch = writeBatch(db);
      DEFAULT_VIP_LEVELS.forEach(vip => {
        const id = `vip_lvl_${vip.level}`;
        batch.set(doc(db, 'vip', id), { ...vip, id });
      });
      DEFAULT_STORE_ITEMS.forEach(item => {
        batch.set(doc(db, 'store', item.id), item);
      });
      DEFAULT_GIFTS.forEach(gift => {
        batch.set(doc(db, 'gifts', gift.id), gift);
      });
      await batch.commit();
      alert('✅ تمت استعادة كافة البيانات بنجاح!');
    } catch (e) {
      alert('❌ فشلت العملية.');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  const handleClearBlacklist = async () => {
    if (!confirm('🔥 هل أنت متأكد؟ هذا الإجراء سيفك الحظر عن جميع الأجهزة والشبكات المحظورة فوراً.')) return;
    setIsProcessing(true);
    setProcessStatus('جاري تنظيف القائمة السوداء...');
    try {
      const snap = await getDocs(collection(db, 'blacklist'));
      const batch = writeBatch(db);
      let count = 0;
      snap.forEach(d => {
        batch.delete(d.ref);
        count++;
      });
      if (count > 0) await batch.commit();
      alert(`✅ تم فك الحظر عن ${count} مستهدف بنجاح!`);
    } catch (e) {
      alert('❌ فشل تنظيف القائمة');
    } finally {
      setIsProcessing(false);
      setProcessStatus('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 text-right font-cairo" dir="rtl">
      <div className="bg-indigo-600/10 border-2 border-indigo-500/30 p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-2xl font-black text-white flex items-center gap-3">
            <DatabaseBackup className="text-indigo-400" size={32} /> صيانة النظام
          </h3>
          <p className="text-slate-400 text-sm font-bold">استعادة رتب الـ VIP، الهدايا الأساسية، وإطارات المتجر.</p>
        </div>
        <button onClick={handleRestoreSystemData} disabled={isProcessing} className="px-10 py-5 bg-indigo-600 text-white font-black rounded-2xl active:scale-95 transition-all disabled:opacity-50">
           {isProcessing ? 'جاري...' : 'استعادة البيانات'}
        </button>
      </div>

      <div className="bg-red-600/10 border-2 border-red-600/30 p-8 rounded-[3rem] shadow-2xl">
        <h3 className="text-2xl font-black text-white flex items-center gap-3 mb-8">
          <ShieldAlert className="text-red-500" /> منطقة العمليات الخطرة
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button onClick={handleClearBlacklist} disabled={isProcessing} className="px-8 py-5 bg-emerald-700 hover:bg-emerald-800 text-white font-black rounded-2xl shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
            <Globe size={22} /> فك حظر الشبكة والأجهزة عن الجميع
          </button>
          
          <button disabled className="px-8 py-5 bg-slate-800 text-white font-black rounded-2xl opacity-50 cursor-not-allowed flex items-center justify-center gap-3">
            <History size={22} /> مسح الأرشيف العام (قريباً)
          </button>
        </div>
        
        {isProcessing && processStatus && (
          <p className="mt-6 text-amber-500 text-center font-black animate-pulse bg-black/40 py-2 rounded-xl">
             {processStatus}
          </p>
        )}
      </div>
    </div>
  );
};

export default AdminMaintenance;
