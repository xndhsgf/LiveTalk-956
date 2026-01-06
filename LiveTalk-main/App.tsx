
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Home, User as UserIcon, Plus, Bell, Crown, Gem, Settings, ChevronRight, Edit3, Share2, LogOut, Shield, Database, ShoppingBag, Camera, Trophy, Flame, Sparkles, UserX, Star, ShieldCheck, MapPin, Download, Smartphone, MessageCircle, Languages, Smartphone as MobileIcon, Wallet, Medal, Lock, AlertCircle, Key, X, Zap, BadgeCheck, ChevronLeft, Award, Coins, Users, UserPlus, Eye, Heart, Gamepad2, UserCheck, Search } from 'lucide-react';
import RoomCard from './components/RoomCard';
import VoiceRoom from './components/VoiceRoom';
import AuthScreen from './components/AuthScreen';
import Toast, { ToastMessage } from './components/Toast';
import VIPModal from './components/VIPModal';
import EditProfileModal from './components/EditProfileModal';
import BagModal from './components/BagModal';
import WalletModal from './components/WalletModal';
import CreateRoomModal from './components/CreateRoomModal';
import GlobalBanner from './components/GlobalBanner';
import GlobalLuckyBagBanner from './components/GlobalLuckyBagBanner';
import AdminPanel from './components/AdminPanel';
import MiniPlayer from './components/MiniPlayer';
import PrivateChatModal from './components/PrivateChatModal';
import MessagesTab from './components/MessagesTab';
import ActivitiesTab from './components/ActivitiesTab';
import AgencyRechargeModal from './components/AgencyRechargeModal';
import WheelGameModal from './components/WheelGameModal';
import SlotsGameModal from './components/SlotsGameModal';
import LionWheelGameModal from './components/LionWheelGameModal';
import CPModal from './components/CPModal';
import HostAgentDashboard from './components/HostAgentDashboard';
import GlobalLeaderboardModal from './components/GlobalLeaderboardModal';
import UserProfileSheet from './components/UserProfileSheet';
import { DEFAULT_VIP_LEVELS, DEFAULT_GIFTS, DEFAULT_STORE_ITEMS } from './constants';
import { Room, User, VIPPackage, UserLevel, Gift, StoreItem, GameSettings, GlobalAnnouncement, LuckyBag, GameType, LuckyMultiplier } from './types';
import { AnimatePresence, motion } from 'framer-motion';
import { db, auth } from './services/firebase';
import { EconomyEngine } from './services/economy'; 
import { collection, onSnapshot, doc, setDoc, query, orderBy, addDoc, getDoc, serverTimestamp, deleteDoc, updateDoc, arrayUnion, arrayRemove, increment, limit, where, writeBatch, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';

const translations = {
  ar: { home: "غرفة", messages: "المحادثة", profile: "انا", activities: "النشاطات", createRoom: "إنشاء", activeRooms: "الغرف النشطة", wallet: "Wallet", vip: "VIP", store: "المتجر", bag: "حقيبة", level: "مستوى", agency: "وكالة", cp: "CP", invite: "invite", blacklist: "القائمة السوداء", privacy: "الخصوصية والسياسة", settings: "إعدادات", id: "ID", myWallet: "المحفظة", logout: "تسجيل الخروج", officialAgent: "وكيل رسمي" },
  en: { home: "Room", messages: "Chats", profile: "Me", activities: "Activities", createRoom: "Create", activeRooms: "Active Rooms", wallet: "Wallet", vip: "VIP", store: "Store", bag: "Bag", level: "Level", agency: "Agency", cp: "CP", invite: "Invite", blacklist: "Blacklist", privacy: "Privacy", settings: "Settings", id: "ID", myWallet: "Wallet", logout: "Logout", officialAgent: "Official Agent" }
};

const ROOT_ADMIN_EMAIL = 'admin-owner@livetalk.com';
const PERMANENT_LOGO_URL = 'https://storage.googleapis.com/static.aistudio.google.com/stables/2025/03/06/f0e64906-e7e0-4a87-af9b-029e2467d302/f0e64906-e7e0-4a87-af9b-029e2467d302.png';

const calculateLvl = (pts: number) => {
  if (!pts || pts <= 0) return 1;
  const l = Math.floor(Math.sqrt(pts / 50000)); 
  return Math.max(1, Math.min(200, l));
};

const HeaderLevelBadge: React.FC<{ level: number; type: 'wealth' | 'recharge' }> = ({ level, type }) => {
  const isWealth = type === 'wealth';
  return (
    <div className="relative h-4 min-w-[42px] flex items-center group cursor-default">
      <div className={`absolute inset-0 rounded-l-sm rounded-r-lg border border-amber-500/30 ${
        isWealth ? 'bg-gradient-to-r from-[#6a29e3] to-[#8b5cf6]' : 'bg-[#121212]'
      }`}></div>
      <div className="relative z-10 flex-1 text-center pr-1">
        <span className="text-[7px] font-black italic text-white drop-shadow-md">{level}</span>
      </div>
      <div className="relative z-20 w-4 h-4 flex items-center justify-center -mr-1">
        <div className={`absolute inset-0 rounded-sm transform rotate-45 border border-amber-500/50 ${
          isWealth ? 'bg-[#7c3aed]' : 'bg-black'
        }`}></div>
        <span className="relative z-30 text-[6px] mb-0.5">👑</span>
      </div>
    </div>
  );
};

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'messages' | 'profile' | 'rank'>('home');
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [isRoomMinimized, setIsRoomMinimized] = useState(false);
  const [isUserMuted, setIsUserMuted] = useState(true);
  const [language, setLanguage] = useState<'ar' | 'en'>('ar');
  
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]); 
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [vipLevels, setVipLevels] = useState<VIPPackage[]>([]);
  const [announcement, setAnnouncement] = useState<GlobalAnnouncement | null>(null);
  const [appBanner, setAppBanner] = useState('');
  const [appName, setAppName] = useState('لايف توك - LiveTalk');
  const [authBackground, setAuthBackground] = useState('');
  const [privateChatPartner, setPrivateChatPartner] = useState<User | null>(null);
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [showGlobalLeaderboard, setShowGlobalLeaderboard] = useState(false);
  const [giftCategoryLabels, setGiftCategoryLabels] = useState<any>(null);
  
  const [showVIPModal, setShowVIPModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showBagModal, setShowBagModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [showAgencyModal, setShowAgencyModal] = useState(false);
  const [showCPModal, setShowCPModal] = useState(false);
  const [showHostAgentDashboard, setShowHostAgentDashboard] = useState(false);
  const [gameSettings, setGameSettings] = useState<GameSettings>({
    slotsWinRate: 35, wheelWinRate: 45, lionWinRate: 35, luckyGiftWinRate: 30, luckyGiftRefundPercent: 0, luckyXEnabled: false, luckyMultipliers: [], wheelJackpotX: 8, wheelNormalX: 2, slotsSevenX: 20, slotsFruitX: 5, availableEmojis: [], emojiDuration: 4
  });

  const [searchIdQuery, setSearchIdQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<User | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);

  const [appLogo, setAppLogo] = useState(() => localStorage.getItem('vivo_live_fixed_logo') || PERMANENT_LOGO_URL);

  const t = translations[language];

  const isRootAdmin = useMemo(() => {
    const currentEmail = auth.currentUser?.email?.toLowerCase();
    const isIdOne = user?.customId?.toString() === '1';
    return currentEmail === ROOT_ADMIN_EMAIL.toLowerCase() || isIdOne;
  }, [auth.currentUser?.email, user?.customId]);

  const canAccessAdmin = useMemo(() => isRootAdmin || user?.isSystemModerator, [isRootAdmin, user?.isSystemModerator]);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).then(() => {
      onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          const unsubUserDoc = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const wealthPts = Number(data.wealth || 0);
              const rechargePts = Number(data.rechargePoints || 0);
              const userData = { 
                id: docSnap.id, ...data,
                wealthLevel: calculateLvl(wealthPts),
                rechargeLevel: calculateLvl(rechargePts),
                coins: Number(data.coins || 0),
                diamonds: Number(data.diamonds || 0),
                wealth: wealthPts,
                rechargePoints: rechargePts
              } as User;
              
              setUser(userData);
              localStorage.setItem('voice_chat_user', JSON.stringify(userData));
            }
            setInitializing(false);
          }, (err) => { setInitializing(false); });
        } else {
          setUser(null);
          localStorage.removeItem('voice_chat_user');
          setInitializing(false);
        }
      });
    }).catch(err => {
      console.error("Persistence Error:", err);
      setInitializing(false);
    });
  }, []);

  useEffect(() => {
    const unsubIdentity = onSnapshot(doc(db, 'appSettings', 'identity'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.appBanner) setAppBanner(data.appBanner);
        if (data.appLogo) setAppLogo(data.appLogo);
        if (data.appName) setAppName(data.appName);
        if (data.authBackground) setAuthBackground(data.authBackground);
      }
    });

    const unsubGameSettings = onSnapshot(doc(db, 'appSettings', 'games'), (docSnap) => {
       if (docSnap.exists() && docSnap.data().gameSettings) setGameSettings(prev => ({ ...prev, ...docSnap.data().gameSettings }));
    });

    const unsubUsersList = onSnapshot(collection(db, 'users'), (snapshot) => {
        setUsers(snapshot.docs.map(doc => {
          const d = doc.data();
          return { id: doc.id, ...d, wealthLevel: calculateLvl(Number(d.wealth || 0)), rechargeLevel: calculateLvl(Number(d.rechargePoints || 0)) } as User;
        }));
    });

    const unsubRooms = onSnapshot(query(collection(db, 'rooms'), orderBy('listeners', 'desc')), (snapshot) => {
      setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
    });

    const unsubGifts = onSnapshot(collection(db, 'gifts'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Gift));
      setGifts(data.length > 0 ? data : DEFAULT_GIFTS);
    });

    const unsubStore = onSnapshot(collection(db, 'store'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreItem));
      const merged = [...data];
      DEFAULT_STORE_ITEMS.forEach(def => { if (!merged.find(m => m.id === def.id)) merged.push(def); });
      setStoreItems(merged);
    });

    const unsubVIP = onSnapshot(collection(db, 'vip'), (snapshot) => {
      const vips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VIPPackage));
      setVipLevels(vips.length > 0 ? vips : DEFAULT_VIP_LEVELS);
    });

    const unsubAnnouncements = onSnapshot(query(collection(db, 'global_announcements'), orderBy('timestamp', 'desc'), limit(1)), (snapshot) => {
      if (!snapshot.empty) {
        const data = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as GlobalAnnouncement;
        setAnnouncement(data);
        setTimeout(() => setAnnouncement(null), 7000);
      }
    });

    return () => { unsubIdentity(); unsubGameSettings(); unsubUsersList(); unsubRooms(); unsubGifts(); unsubStore(); unsubVIP(); unsubAnnouncements(); };
  }, []);

  const handleLogout = async () => {
    if (confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟')) {
      try {
        await signOut(auth);
        setUser(null);
        localStorage.clear();
        // ضمان تصفية الحالة والعودة لشاشة الدخول فوراً
        window.location.reload(); 
      } catch (e) {
        alert('حدث خطأ أثناء تسجيل الخروج');
      }
    }
  };

  const handleUpdateUser = async (updatedData: Partial<User>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.id), updatedData);
    } catch (e) { console.error("Firestore Update Failed:", e); }
  };

  const handleUpdateAnyUser = async (userId: string, data: Partial<User>) => {
    try {
      await updateDoc(doc(db, 'users', userId), data);
    } catch (e) { console.error("Admin Update User Failed:", e); }
  };

  const handleUpdateRoom = async (roomId: string, data: Partial<Room>) => {
    try { await updateDoc(doc(db, 'rooms', roomId), data); } catch (e) { console.error("Admin Update Room Failed:", e); }
  };

  const executeCreateRoom = async (template: any) => {
    if (!user) return;
    const hostAsSpeaker = { 
      id: user.id, 
      customId: user.customId, 
      name: user.name, 
      avatar: user.avatar, 
      seatIndex: 0, 
      isMuted: false, 
      charm: 0, 
      frame: user.frame || null 
    };
    const roomDocRef = doc(db, 'rooms', user.id);
    try {
      await setDoc(roomDocRef, { 
        ...template, 
        hostId: user.id, 
        hostCustomId: user.customId, 
        listeners: 1, 
        speakers: [hostAsSpeaker], 
        micCount: 8 
      });
      setCurrentRoom({ id: user.id, ...template, hostId: user.id, hostCustomId: user.customId, listeners: 1, speakers: [hostAsSpeaker], micCount: 8 } as any);
    } catch (e) {
      console.error("Room Creation Failed:", e);
    }
  };

  const handleVIPPurchase = async (vip: VIPPackage) => {
    if (!user) return;
    const success = await EconomyEngine.buyVIP(user.id, user.coins, user.wealth, vip, handleUpdateUser);
    if (success) {
      alert(`مبروك! تم تفعيل رتبة ${vip.name} بنجاح ✅`);
      setShowVIPModal(false);
    } else {
      alert('فشل تفعيل الرتبة، تأكد من رصيدك');
    }
  };

  const handleAgencyRecharge = async (targetId: string, amount: number) => {
    if (!user) return;
    const targetUser = users.find(u => u.id === targetId);
    if (!targetUser) return;
    
    const success = await EconomyEngine.agencyTransfer(
      user.id, 
      user.agencyBalance, 
      targetId, 
      targetUser.coins, 
      targetUser.rechargePoints, 
      amount, 
      (agentData, targetData) => {
        handleUpdateUser(agentData);
        handleUpdateAnyUser(targetId, targetData);
      }
    );
    
    if (success) {
      alert('تم الشحن بنجاح ✅');
    } else {
      alert('فشلت عملية الشحن');
    }
  };

  if (initializing) return <div className="h-screen w-full bg-[#030816] flex items-center justify-center"><div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (!user) return <AuthScreen onAuth={(u) => { setUser(u); localStorage.setItem('voice_chat_user', JSON.stringify(u)); }} appLogo={appLogo} authBackground={authBackground} />;

  return (
    <div className="h-[100dvh] w-full bg-[#030816] text-white relative md:max-w-md mx-auto shadow-2xl overflow-hidden flex flex-col font-cairo">
      <div className="absolute top-0 left-0 right-0 z-[10000] pointer-events-none">
        <AnimatePresence>{announcement && ( <GlobalBanner announcement={announcement} /> )}</AnimatePresence>
      </div>
      
      <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
        {activeTab === 'home' && (
           <div className="mt-2 space-y-3 px-4 relative">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2"><img src={appLogo} className="w-8 h-8 rounded-lg" /><span className="text-xs font-black text-white/40 uppercase tracking-widest">LIVETALK</span></div>
                <div className="relative flex-1 max-w-[200px] mr-2">
                   <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                   <input type="text" placeholder="ابحث بالـ ID..." value={searchIdQuery} onFocus={() => setShowSearchResults(true)} onChange={(e) => setSearchIdQuery(e.target.value)} className="w-full bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-full py-1.5 pr-9 pl-3 text-[10px] text-white outline-none font-black" />
                   <AnimatePresence>
                     {showSearchResults && searchIdQuery.trim() !== '' && (
                       <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="absolute top-10 right-0 left-0 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl z-[110] overflow-hidden">
                          {users.filter(u => u.customId?.toString() === searchIdQuery).map(u => (
                            <button key={u.id} onClick={() => { setSelectedUserForProfile(u); setShowProfileSheet(true); setShowSearchResults(false); setSearchIdQuery(''); }} className="w-full p-3 flex items-center gap-3 hover:bg-white/5 border-b border-white/5 last:border-0 text-right">
                               <div className="relative"><img src={u.avatar} className="w-10 h-10 rounded-full object-cover" /></div>
                               <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-black text-white truncate">{u.name}</p>
                                  <p className="text-[8px] text-amber-500 font-bold">ID: {u.customId}</p>
                               </div>
                            </button>
                          ))}
                       </motion.div>
                     )}
                   </AnimatePresence>
                </div>
              </div>
              <div className="relative w-full h-28 rounded-2xl overflow-hidden bg-slate-800 border border-white/5 shadow-lg">{appBanner && <img src={appBanner} className="w-full h-full object-cover" />}</div>
              <div className="flex justify-between items-center px-1"><h2 className="text-xs font-bold text-white flex items-center gap-1.5"><Flame size={14} className="text-orange-500" /> {t.activeRooms}</h2><button onClick={() => setShowGlobalLeaderboard(true)} className="bg-gradient-to-r from-amber-500 to-orange-600 p-2 rounded-xl border border-amber-400/30"><Trophy size={18} className="text-white" fill="currentColor" /></button></div>
              <div className="grid gap-2.5">{rooms.map(room => ( <RoomCard key={room.id} room={room} onClick={(r) => { setCurrentRoom(r); updateDoc(doc(db, 'rooms', r.id), { listeners: increment(1) }); }} /> ))}</div>
           </div>
        )}
        
        {activeTab === 'messages' && <MessagesTab currentUser={user} onOpenChat={setPrivateChatPartner} />}
        {activeTab === 'rank' && <ActivitiesTab onOpenGame={setActiveGame} />}
        
        {activeTab === 'profile' && (
          <div className="flex flex-col bg-[#030816] min-h-full" dir="rtl">
            <div className="relative w-full h-44 shrink-0 overflow-hidden">
               {user.cover ? <img src={user.cover} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-blue-900 to-black"></div>}
               <div className="absolute bottom-3 right-5 flex items-center gap-3">
                  <div className="relative w-16 h-16"><div className="w-full h-full rounded-full border-2 border-white/20 overflow-hidden bg-slate-900 shadow-2xl"><img src={user.avatar} className="w-full h-full object-cover" /></div>{user.frame && <img src={user.frame} className="absolute inset-0 scale-[1.3]" />}</div>
                  <div className="flex flex-col gap-1">
                     <h2 className="text-base font-black text-white">{user.name}</h2>
                     <div className="flex items-center gap-2"><div className="bg-white/10 px-2 py-0.5 rounded-lg border border-white/10 text-[9px] font-black">ID:{user.customId || user.id}</div><HeaderLevelBadge level={calculateLvl(user.wealth || 0)} type="wealth" /><HeaderLevelBadge level={calculateLvl(user.rechargePoints || 0)} type="recharge" /></div>
                  </div>
               </div>
               <button onClick={() => setShowEditProfileModal(true)} className="absolute top-10 left-5 p-2 bg-black/40 rounded-full"><Camera size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 px-4 mt-5">
              <button onClick={() => setShowWalletModal(true)} className="h-20 rounded-2xl bg-gradient-to-r from-blue-400 to-cyan-500 flex flex-col items-center justify-center shadow-lg active:scale-95"><Wallet size={20}/><span className="font-black text-sm">Wallet</span></button>
              <button onClick={() => setShowVIPModal(true)} className="h-20 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-800 flex flex-col items-center justify-center shadow-lg active:scale-95"><Crown size={20}/><span className="font-black text-sm">VIP</span></button>
            </div>
            
            <div className="mx-4 mt-5 p-5 bg-white/5 rounded-[2rem] border border-white/5 grid grid-cols-4 gap-y-6">
               <button onClick={() => user.isHostAgent ? setShowHostAgentDashboard(true) : alert('للموزعين المعتمدين فقط')} className="flex flex-col items-center gap-1"><div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-lg ${user.isHostAgent ? 'bg-blue-600 border-blue-400' : 'bg-slate-800'}`}><UserCheck size={20}/></div><span className="text-[10px] font-black">{t.officialAgent}</span></button>
               <button onClick={() => setShowBagModal(true)} className="flex flex-col items-center gap-1"><div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg"><ShoppingBag size={20}/></div><span className="text-[10px] font-black">حقيبة</span></button>
               <button onClick={() => setShowCPModal(true)} className="flex flex-col items-center gap-1"><div className="w-12 h-12 bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg border border-rose-400/30"><Heart size={20} fill="currentColor"/></div><span className="text-[10px] font-black">CP</span></button>
               <button onClick={() => user.isAgency && setShowAgencyModal(true)} className="flex flex-col items-center gap-1"><div className="w-12 h-12 bg-blue-900 rounded-2xl flex items-center justify-center shadow-lg"><Zap size={20}/></div><span className="text-[10px] font-black">وكالة</span></button>
            </div>

            <div className="mt-6 px-6 grid grid-cols-4 gap-4">
               <button className="flex flex-col items-center gap-1"><div className="p-3 bg-white/5 rounded-2xl"><UserPlus size={18}/></div><span className="text-[9px]">دعوة</span></button>
               <button className="flex flex-col items-center gap-1"><div className="p-3 bg-white/5 rounded-2xl"><UserX size={18}/></div><span className="text-[9px]">حظر</span></button>
               <button className="flex flex-col items-center gap-1"><div className="p-3 bg-white/5 rounded-2xl"><ShieldCheck size={18}/></div><span className="text-[9px]"> الخصوصية</span></button>
               <button onClick={() => canAccessAdmin ? setShowAdminPanel(true) : alert('غير مسموح')} className="flex flex-col items-center gap-1 transition-all"><div className={`p-3 rounded-2xl ${canAccessAdmin ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-white/5 text-slate-600'}`}><Settings size={18} /></div><span className={`text-[9px] ${canAccessAdmin ? 'text-amber-500 font-black' : ''}`}>السيستم</span></button>
            </div>

            <button 
              onClick={handleLogout} 
              className="mx-8 mt-10 mb-24 py-4 bg-red-600/10 text-red-500 rounded-2xl border border-red-500/20 font-black text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={16} /> {t.logout}
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>{isRoomMinimized && currentRoom && (<MiniPlayer room={currentRoom} onExpand={() => setIsRoomMinimized(false)} onLeave={() => { setCurrentRoom(null); setIsRoomMinimized(false); }} isMuted={isUserMuted} onToggleMute={() => setIsUserMuted(!isUserMuted)} />)}</AnimatePresence>

      <div className="absolute bottom-0 left-0 right-0 bg-[#030816] border-t border-blue-900/30 h-20 flex items-center px-4 z-20 pb-[env(safe-area-inset-bottom)]">
         <div className="relative w-full h-14 bg-gradient-to-r from-blue-900/40 via-blue-800/20 to-blue-900/40 rounded-full border border-blue-800/30 flex items-center justify-around">
            <button onClick={() => setActiveTab('home')} className={activeTab === 'home' ? 'text-cyan-400' : 'text-slate-500'}><Home size={20}/></button>
            <button onClick={() => setActiveTab('messages')} className={activeTab === 'messages' ? 'text-cyan-400' : 'text-slate-500'}><MessageCircle size={20}/></button>
            <button onClick={() => user.roomTemplate ? executeCreateRoom(user.roomTemplate) : setShowCreateRoomModal(true)} className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center -translate-y-4 border-4 border-[#030816] shadow-lg"><Plus size={28}/></button>
            <button onClick={() => setActiveTab('rank')} className={activeTab === 'rank' ? 'text-cyan-400' : 'text-slate-500'}><Gamepad2 size={20}/></button>
            <button onClick={() => setActiveTab('profile')} className={activeTab === 'profile' ? 'text-cyan-400' : 'text-slate-500'}><UserIcon size={20}/></button>
         </div>
      </div>

      <AnimatePresence>
        {currentRoom && (
          <motion.div key="voice-room-wrapper" initial={{ y: "100%" }} animate={{ y: isRoomMinimized ? "100%" : "0%", opacity: isRoomMinimized ? 0 : 1 }} exit={{ y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-0 z-[150] overflow-hidden" style={{ pointerEvents: isRoomMinimized ? 'none' : 'auto' }}>
            <VoiceRoom room={currentRoom} currentUser={user!} onUpdateUser={handleUpdateUser} onLeave={() => { setCurrentRoom(null); setIsRoomMinimized(false); }} onMinimize={() => setIsRoomMinimized(true)} isMinimized={isRoomMinimized} gifts={gifts} onEditProfile={() => setShowEditProfileModal(true)} gameSettings={gameSettings} onUpdateRoom={handleUpdateRoom} isMuted={isUserMuted} onToggleMute={() => setIsUserMuted(!isUserMuted)} users={users} onOpenPrivateChat={setPrivateChatPartner} giftCategoryLabels={giftCategoryLabels} />
          </motion.div>
        )}
      </AnimatePresence>
      
      {showGlobalLeaderboard && <GlobalLeaderboardModal isOpen={showGlobalLeaderboard} onClose={() => setShowGlobalLeaderboard(false)} users={users} />}
      {showVIPModal && <VIPModal user={user} vipLevels={vipLevels} onClose={() => setShowVIPModal(false)} onBuy={handleVIPPurchase} />}
      {showEditProfileModal && <EditProfileModal isOpen={showEditProfileModal} onClose={() => setShowEditProfileModal(false)} currentUser={user} onSave={handleUpdateUser} />}
      {showBagModal && <BagModal isOpen={showBagModal} onClose={() => setShowBagModal(false)} items={storeItems} user={user} onBuy={(item) => EconomyEngine.spendCoins(user.id, user.coins, user.wealth, item.price, user.ownedItems || [], item.id, handleUpdateUser)} onEquip={(item) => handleUpdateUser(item.type === 'frame' ? { frame: item.url } : item.type === 'bubble' ? { activeBubble: item.url } : { activeEntry: item.url })} />}
      {showWalletModal && <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} user={user} onExchange={(amt) => EconomyEngine.exchangeDiamonds(user.id, user.coins, user.diamonds, amt, handleUpdateUser)} />}
      {showAdminPanel && <AdminPanel isOpen={showAdminPanel} onClose={() => setShowAdminPanel(false)} currentUser={user!} users={users} onUpdateUser={handleUpdateAnyUser} rooms={rooms} setRooms={setRooms} onUpdateRoom={handleUpdateRoom} gifts={gifts} storeItems={storeItems} vipLevels={vipLevels} gameSettings={gameSettings} setGameSettings={(s) => setDoc(doc(db, 'appSettings', 'games'), { gameSettings: s }, { merge: true })} appBanner={appBanner} onUpdateAppBanner={(url) => setDoc(doc(db, 'appSettings', 'identity'), { appBanner: url }, { merge: true })} appLogo={appLogo} onUpdateAppLogo={(url) => setDoc(doc(db, 'appSettings', 'identity'), { appLogo: url }, { merge: true })} appName={appName} onUpdateAppName={(name) => setDoc(doc(db, 'appSettings', 'identity'), { appName: name }, { merge: true })} authBackground={authBackground} onUpdateAuthBackground={(url) => setDoc(doc(db, 'appSettings', 'identity'), { authBackground: url }, { merge: true })} />}
      {showCreateRoomModal && <CreateRoomModal isOpen={showCreateRoomModal} onClose={() => setShowCreateRoomModal(false)} onCreate={(data) => { const hostAsSpeaker = { id: user.id, customId: user.customId, name: user.name, avatar: user.avatar, seatIndex: 0, isMuted: false, charm: 0, frame: user.frame || null }; const roomDocRef = doc(db, 'rooms', user.id); setDoc(roomDocRef, { ...data, hostId: user.id, hostCustomId: user.customId, listeners: 1, speakers: [hostAsSpeaker], micCount: 8 }).then(() => { setCurrentRoom({ id: user.id, ...data, hostId: user.id, hostCustomId: user.customId, listeners: 1, speakers: [hostAsSpeaker], micCount: 8 } as any); }); }} />}
      {user.isAgency && showAgencyModal && <AgencyRechargeModal isOpen={showAgencyModal} onClose={() => setShowAgencyModal(false)} agentUser={user} users={users} onCharge={handleAgencyRecharge} />}
      {showCPModal && <CPModal isOpen={showCPModal} onClose={() => setShowCPModal(false)} currentUser={user} users={users} gameSettings={gameSettings} onUpdateUser={handleUpdateUser} />}
      {user.isHostAgent && showHostAgentDashboard && <HostAgentDashboard isOpen={showHostAgentDashboard} onClose={() => setShowHostAgentDashboard(false)} agentUser={user} allUsers={users} />}
      {activeGame === 'wheel' && <WheelGameModal isOpen={activeGame === 'wheel'} onClose={() => setActiveGame(null)} userCoins={Number(user.coins)} onUpdateCoins={(c) => handleUpdateUser({ coins: c })} winRate={gameSettings.wheelWinRate} gameSettings={gameSettings} />}
      {activeGame === 'slots' && <SlotsGameModal isOpen={activeGame === 'slots'} onClose={() => setActiveGame(null)} userCoins={Number(user.coins)} onUpdateCoins={(c) => handleUpdateUser({ coins: c })} winRate={gameSettings.slotsWinRate} gameSettings={gameSettings} />}
      {activeGame === 'lion' && <LionWheelGameModal isOpen={activeGame === 'lion'} onClose={() => setActiveGame(null)} userCoins={Number(user.coins)} onUpdateCoins={(c) => handleUpdateUser({ coins: c })} gameSettings={gameSettings} />}
      <AnimatePresence>{showProfileSheet && selectedUserForProfile && (<UserProfileSheet user={selectedUserForProfile} onClose={() => setShowProfileSheet(false)} isCurrentUser={selectedUserForProfile.id === user.id} onAction={(action) => { if (action === 'message') setPrivateChatPartner(selectedUserForProfile); if (action === 'cp') setShowCPModal(true); }} currentUser={user} allUsers={users} currentRoom={currentRoom || { id: 'lobby', title: 'لوبي', category: 'تعارف', hostId: '', speakers: [], thumbnail: '', listeners: 0, background: '' }} />)}</AnimatePresence>
    </div>
  );
}

