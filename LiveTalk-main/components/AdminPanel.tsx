import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, ShieldCheck, Activity, Gift as GiftIcon, ShoppingBag, 
  Crown, Smartphone, Eraser, X, Medal, IdCard, Layout, Zap, Smile, Heart, Building, Image as ImageIcon, UserCircle, Home
} from 'lucide-react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { User, Room, Gift, StoreItem, GameSettings, VIPPackage } from '../types';

import AdminUsers from './Admin/AdminUsers';
import AdminGames from './Admin/AdminGames';
import AdminGifts from './Admin/AdminGifts';
import AdminStore from './Admin/AdminStore';
import AdminVIP from './Admin/AdminVIP';
import AdminIdentity from './Admin/AdminIdentity';
import AdminMaintenance from './Admin/AdminMaintenance';
import AdminBadges from './Admin/AdminBadges';
import AdminIdBadges from './Admin/AdminIdBadges';
import AdminMicSkins from './Admin/AdminMicSkins';
import AdminAgency from './Admin/AdminAgency';
import AdminHostAgencies from './Admin/AdminHostAgencies';
import AdminEmojis from './Admin/AdminEmojis';
import AdminRelationships from './Admin/AdminRelationships';
import AdminBackgrounds from './Admin/AdminBackgrounds';
import AdminDefaults from './Admin/AdminDefaults';
import AdminRooms from './Admin/AdminRooms';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  users: User[];
  onUpdateUser: (userId: string, data: Partial<User>) => Promise<void>;
  rooms: Room[];
  setRooms: (rooms: Room[]) => void;
  onUpdateRoom: (roomId: string, data: Partial<Room>) => Promise<void>;
  gifts: Gift[];
  storeItems: StoreItem[];
  vipLevels: VIPPackage[];
  gameSettings: GameSettings;
  setGameSettings: (settings: GameSettings) => Promise<void>;
  appBanner: string;
  onUpdateAppBanner: (url: string) => void;
  appLogo: string;
  onUpdateAppLogo: (url: string) => void;
  appName: string;
  onUpdateAppName: (name: string) => void;
  authBackground: string;
  onUpdateAuthBackground: (url: string) => void;
}

const ROOT_ADMIN_EMAIL = 'admin-owner@livetalk.com';

const compressImage = (base64: string, maxWidth: number, maxHeight: number, quality: number = 0.2): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width; let height = img.height;
      if (width > height) { if (width > maxWidth) { height *= maxWidth / width; width = maxWidth; } }
      else { if (height > maxHeight) { width *= maxHeight / height; height = maxHeight; } }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, width, height);
      }
      resolve(canvas.toDataURL('image/webp', quality));
    };
    img.onerror = () => resolve(base64);
  });
};

const AdminPanel: React.FC<AdminPanelProps> = (props) => {
  const currentEmail = (props.currentUser as any).email?.toLowerCase() || '';
  const isIdOne = props.currentUser.customId?.toString() === '1';
  const isRootAdmin = currentEmail === ROOT_ADMIN_EMAIL.toLowerCase() || isIdOne;
  const isModerator = props.currentUser.isSystemModerator;

  const menuItems = [
    { id: 'users', label: 'الأعضاء', icon: Users, color: 'text-blue-400' },
    { id: 'rooms_manage', label: 'إدارة الغرف', icon: Home, color: 'text-red-500' },
    { id: 'defaults', label: 'صور البداية', icon: UserCircle, color: 'text-indigo-400' },
    { id: 'badges', label: 'أوسمة الشرف', icon: Medal, color: 'text-yellow-500' },
    { id: 'id_badges', label: 'أوسمة الـ ID', icon: IdCard, color: 'text-blue-500' },
    { id: 'host_agency', label: 'وكالات المضيفين', icon: Building, color: 'text-emerald-400' },
    { id: 'room_bgs', label: 'خلفيات الغرف', icon: ImageIcon, color: 'text-indigo-400' },
    { id: 'mic_skins', label: 'أشكال المايكات', icon: Layout, color: 'text-indigo-500' },
    { id: 'emojis', label: 'الإيموشنات', icon: Smile, color: 'text-yellow-400' },
    { id: 'relationships', label: 'نظام الارتباط', icon: Heart, color: 'text-pink-500' },
    { id: 'agency', label: 'الوكالات (شحن)', icon: Zap, color: 'text-orange-500' },
    { id: 'games', label: 'مركز الحظ', icon: Activity, color: 'text-orange-400' },
    { id: 'gifts', label: 'الهدايا', icon: GiftIcon, color: 'text-pink-400' },
    { id: 'store', label: 'المتجر', icon: ShoppingBag, color: 'text-cyan-400' },
    { id: 'vip', label: 'الـ VIP', icon: Crown, color: 'text-amber-400' },
    { id: 'identity', label: 'الهوية', icon: Smartphone, color: 'text-emerald-400' },
    { id: 'maintenance', label: 'الصيانة', icon: Eraser, color: 'text-red-500' },
  ];

  // فلترة القائمة بناءً على الصلاحيات
  const allowedMenuItems = menuItems.filter(item => {
    if (isRootAdmin) return true; // المالك يرى كل شيء
    if (isModerator && props.currentUser.moderatorPermissions?.includes(item.id)) return true; // المشرف يرى ما خُصص له
    return false;
  });

  const [activeTab, setActiveTab] = useState<string>(allowedMenuItems[0]?.id || 'users');

  if (!props.isOpen || (!isRootAdmin && !isModerator)) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string) => void, w: number, h: number) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('حجم الملف الأصلي كبير جداً (أكثر من 1 ميجابايت). يرجى ضغطه أولاً قبل الرفع.');
        return;
      }

      const reader = new FileReader();
      reader.onload = async (ev) => {
        const result = ev.target?.result as string;
        
        if (file.type === 'image/gif' || file.type.startsWith('video/')) {
          if (result.length > 900000) {
             alert('ملف الـ GIF كبير جداً بعد التحويل. يرجى اختيار ملف أصغر لضمان الحفظ.');
             return;
          }
          callback(result);
        } else {
          const compressed = await compressImage(result, w, h, 0.2);
          if (compressed.length > 950000) {
             alert('حتى بعد الضغط، الصورة لا تزال كبيرة جداً. يرجى تقليل أبعادها يدوياً.');
             return;
          }
          callback(compressed);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateGameSettings = async (updates: Partial<GameSettings>) => {
    const newSettings = { ...props.gameSettings, ...updates };
    await props.setGameSettings(newSettings);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-[#020617] flex flex-col md:flex-row font-cairo overflow-hidden text-right" dir="rtl">
      <div className="w-full md:w-64 bg-slate-950 border-l border-white/5 flex flex-col shrink-0 shadow-2xl z-10">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <span className="font-black text-white">{isRootAdmin ? 'المدير العام' : 'لوحة المشرف'}</span>
          </div>
          <button onClick={props.onClose} className="text-slate-400 p-2"><X size={24}/></button>
        </div>
        <nav className="flex md:flex-col p-3 gap-1 overflow-x-auto md:overflow-y-auto custom-scrollbar scrollbar-hide">
          {allowedMenuItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${activeTab === item.id ? 'bg-white/10 text-white' : 'text-slate-500 hover:bg-white/5'}`}>
              <item.icon size={18} className={activeTab === item.id ? item.color : ''} />
              <span className="text-xs font-black">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="flex-1 bg-slate-900/40 overflow-y-auto p-6 md:p-10 custom-scrollbar transition-all duration-100">
        {activeTab === 'users' && <AdminUsers users={props.users} vipLevels={props.vipLevels} onUpdateUser={props.onUpdateUser} currentUser={props.currentUser} />}
        {activeTab === 'rooms_manage' && <AdminRooms rooms={props.rooms} />}
        {activeTab === 'defaults' && <AdminDefaults handleFileUpload={handleFileUpload} />}
        {activeTab === 'badges' && <AdminBadges users={props.users} onUpdateUser={props.onUpdateUser} />}
        {activeTab === 'id_badges' && <AdminIdBadges users={props.users} onUpdateUser={props.onUpdateUser} />}
        {activeTab === 'host_agency' && <AdminHostAgencies users={props.users} onUpdateUser={props.onUpdateUser} />}
        {activeTab === 'room_bgs' && <AdminBackgrounds handleFileUpload={handleFileUpload} />}
        {activeTab === 'mic_skins' && <AdminMicSkins handleFileUpload={handleFileUpload} />}
        {activeTab === 'agency' && <AdminAgency users={props.users} onUpdateUser={props.onUpdateUser} />}
        {activeTab === 'emojis' && <AdminEmojis gameSettings={props.gameSettings} onUpdateGameSettings={handleUpdateGameSettings} handleFileUpload={handleFileUpload} />}
        {activeTab === 'relationships' && <AdminRelationships gameSettings={props.gameSettings} onUpdateGameSettings={handleUpdateGameSettings} handleFileUpload={handleFileUpload} />}
        {activeTab === 'games' && <AdminGames gameSettings={props.gameSettings} onUpdateGameSettings={handleUpdateGameSettings} handleFileUpload={handleFileUpload} />}
        {activeTab === 'gifts' && <AdminGifts gifts={props.gifts} onSaveGift={async (g, d) => { const ref = doc(db, 'gifts', g.id); d ? await deleteDoc(ref) : await setDoc(ref, g); }} handleFileUpload={handleFileUpload} />}
        {activeTab === 'store' && <AdminStore storeItems={props.storeItems} onSaveItem={async (i, d) => { const ref = doc(db, 'store', i.id); d ? await deleteDoc(ref) : await setDoc(ref, i); }} handleFileUpload={handleFileUpload} />}
        {activeTab === 'vip' && <AdminVIP vipLevels={props.vipLevels} onSaveVip={async (v, d) => { const id = `vip_lvl_${v.level}`; const ref = doc(db, 'vip', id); d ? await deleteDoc(ref) : await setDoc(ref, { ...v, id }); }} handleFileUpload={handleFileUpload} />}
        {activeTab === 'identity' && <AdminIdentity appLogo={props.appLogo} appBanner={props.appBanner} appName={props.appName} authBackground={props.authBackground} onUpdateAppLogo={props.onUpdateAppLogo} onUpdateAppBanner={props.onUpdateAppBanner} onUpdateAppName={props.onUpdateAppName} onUpdateAuthBackground={props.onUpdateAuthBackground} handleFileUpload={handleFileUpload} />}
        {activeTab === 'maintenance' && <AdminMaintenance currentUser={props.currentUser} />}
      </div>
    </div>
  );
};

export default AdminPanel;