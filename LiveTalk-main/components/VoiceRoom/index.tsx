
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../../services/firebase';
import { doc, collection, addDoc, updateDoc, increment, serverTimestamp, writeBatch, onSnapshot, getDoc, query, orderBy, limit, where, Timestamp, setDoc, deleteDoc, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { Gift, Room, User, LuckyMultiplier, GameType, LuckyBag, CPPartner } from '../../types';
import { EconomyEngine } from '../../services/economy';

// استيراد المكونات
import RoomBackground from './RoomBackground';
import RoomHeader from './RoomHeader';
import GiftAnimationLayer from './GiftAnimationLayer';
import EntryAnimationLayer from './EntryAnimationLayer'; 
import Seat from './Seat';
import ComboButton from './ComboButton';
import ControlBar from './ControlBar';
import ReactionPicker from './ReactionPicker';
import GiftModal from '../GiftModal';
import RoomSettingsModal from '../RoomSettingsModal';
import RoomRankModal from '../RoomRankModal';
import RoomToolsModal from './RoomToolsModal'; 
import LuckyBagModal from '../LuckyBagModal';
import LuckyBagActive from '../LuckyBagActive';
import UserProfileSheet from '../UserProfileSheet';
import GameCenterModal from '../GameCenterModal';
import WheelGameModal from '../WheelGameModal';
import SlotsGameModal from '../SlotsGameModal';
import LionWheelGameModal from '../LionWheelGameModal';
import WinStrip from '../WinStrip';
import EditProfileModal from '../EditProfileModal';
import RoomParticipantsModal from './RoomParticipantsModal';
import { AnimatePresence, motion } from 'framer-motion';

// دالة الحساب الفورية للمستوى
const calculateLiveLvl = (pts: number) => {
  if (!pts || pts <= 0) return 1;
  const l = Math.floor(Math.sqrt(pts / 50000)); 
  return Math.max(1, Math.min(200, l));
};

const ChatLevelBadge: React.FC<{ level: number; type: 'wealth' | 'recharge' }> = ({ level, type }) => {
  const isWealth = type === 'wealth';
  return (
    <div className="relative h-[20px] min-w-[65px] flex items-center pr-3 group cursor-default shrink-0">
      <div className={`absolute inset-0 right-3 rounded-l-md border border-amber-500/60 shadow-lg ${
        isWealth 
          ? 'bg-gradient-to-r from-[#6a29e3] to-[#8b5cf6]' 
          : 'bg-[#121212]'
      }`}>
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]"></div>
      </div>
      <div className="relative z-10 flex-1 text-center pl-1 pr-1">
        <span className="text-[11px] font-black italic tracking-tighter text-white drop-shadow-md leading-none block transform translate-y-[0.5px]">
          {level}
        </span>
      </div>
      <div className="relative z-20 w-[22px] h-[22px] flex items-center justify-center -mr-2">
        <div className={`absolute inset-0 rounded-sm transform rotate-45 border border-amber-500 shadow-md ${
          isWealth ? 'bg-[#7c3aed]' : 'bg-[#000]'
        }`}></div>
        <span className="relative z-30 text-[10px] mb-0.5 drop-shadow-md select-none">👑</span>
      </div>
    </div>
  );
};

const VoiceRoom: React.FC<any> = ({ 
  room: initialRoom, onLeave, onMinimize, currentUser, gifts, gameSettings, onUpdateRoom, 
  isMuted, onToggleMute, onUpdateUser, users, onEditProfile, onAnnouncement, onOpenPrivateChat,
  giftCategoryLabels, isMinimized
}) => {
  const [room, setRoom] = useState<Room>(initialRoom);
  const [showGifts, setShowGifts] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showRank, setShowRank] = useState(false);
  const [showLuckyBag, setShowLuckyBag] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [activeBags, setActiveBags] = useState<LuckyBag[]>([]);
  const [roomParticipants, setRoomParticipants] = useState<User[]>([]);
  const [showGameCenter, setShowGameCenter] = useState(false);
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [showProfileSheet, setShowProfileSheet] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<User | null>(null);
  const [micSkins, setMicSkins] = useState<Record<string, string>>({});
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<string[]>([]);
  
  const [isGiftActive, setIsGiftActive] = useState(false);
  const [isEntryActive, setIsEntryActive] = useState(false);
  
  const [sessionStartTime] = useState<number>(Date.now());
  const [localSpeakers, setLocalSpeakers] = useState<any[]>(initialRoom.speakers || []);
  const [localMicCount, setLocalMicCount] = useState<number>(Number(initialRoom.micCount || 8));
  const [comboState, setComboState] = useState<{gift: Gift, recipients: string[], count: number} | null>(null);
  const [luckyWinAmount, setLuckyWinAmount] = useState<number>(0); 
  
  const comboSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboExpireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emojiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const hasSentEntryRef = useRef<boolean>(false); 
  
  const pendingSyncData = useRef<{giftId: string, count: number, recipients: string[], totalCost: number, totalWin: number} | null>(null);
  const pendingRoomSpeakers = useRef<any[] | null>(null);
  const roomSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const giftAnimRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const isHost = room.hostId === currentUser.id;
  const isModerator = room.moderators?.includes(currentUser.id);
  const canAdmin = isHost || isModerator;

  // إرسال دخولية المستخدم فور انضمامه للغرفة مع مراعاة المدة
  useEffect(() => {
    if (!initialRoom.id || !currentUser.id || hasSentEntryRef.current) return;
    
    if (currentUser.activeEntry) {
      addDoc(collection(db, 'rooms', initialRoom.id, 'entry_events'), {
        userId: currentUser.id,
        userName: currentUser.name,
        videoUrl: currentUser.activeEntry,
        duration: currentUser.activeEntryDuration || 6, // إرسال المدة
        timestamp: serverTimestamp()
      }).catch(e => console.error("Entry Trigger Failed", e));
      
      hasSentEntryRef.current = true;
    }
  }, [initialRoom.id, currentUser.id, currentUser.activeEntry, currentUser.activeEntryDuration]);

  // جلب أشكال المايكات المخصصة من السيستم
  useEffect(() => {
    const unsubSkins = onSnapshot(doc(db, 'appSettings', 'micSkins'), (snap) => {
      if (snap.exists()) {
        setMicSkins(snap.data() as Record<string, string>);
      }
    });
    return () => unsubSkins();
  }, []);

  // فحص الحظر الفوري عند الدخول
  useEffect(() => {
    if (room.kickedUsers?.includes(currentUser.id)) {
      alert('لقد تم حظرك من دخول هذه الغرفة');
      onLeave();
    }
  }, [room.kickedUsers, currentUser.id]);

  useEffect(() => {
    if (!initialRoom.id || !currentUser.id) return;
    const participantRef = doc(db, 'rooms', initialRoom.id, 'participants', currentUser.id);
    setDoc(participantRef, {
        id: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar,
        customId: currentUser.customId || null,
        wealthLevel: currentUser.wealthLevel || 1,
        isVip: currentUser.isVip || false,
        badge: currentUser.badge || null,
        joinedAt: serverTimestamp()
    });
    return () => { deleteDoc(participantRef).catch(() => {}); };
  }, [initialRoom.id, currentUser.id]);

  useEffect(() => {
    const q = collection(db, 'rooms', initialRoom.id, 'participants');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const parts = snapshot.docs.map(doc => doc.data() as User);
      setRoomParticipants(parts);
      if (isHost) {
        updateDoc(doc(db, 'rooms', initialRoom.id), { listeners: parts.length }).catch(() => {});
      }
    });
    return () => unsubscribe();
  }, [initialRoom.id, isHost]);

  useEffect(() => {
    const unsubRoom = onSnapshot(doc(db, 'rooms', initialRoom.id), (snap) => {
      if (snap.exists()) {
        const roomData = { id: snap.id, ...snap.data() } as Room;
        setRoom(roomData);
        setLocalSpeakers(roomData.speakers || []);
        if (!roomSyncTimerRef.current) {
          setLocalMicCount(Number(roomData.micCount || 8));
        }
        // إذا تم طرد المستخدم حالياً، نخرجه فوراً
        if (roomData.kickedUsers?.includes(currentUser.id)) {
          onLeave();
        }
      }
    });
    return () => unsubRoom();
  }, [initialRoom.id, currentUser.id]);

  // Listen for lucky bags in this room
  useEffect(() => {
    const q = query(
      collection(db, 'lucky_bags'),
      where('roomId', '==', initialRoom.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const bags = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LuckyBag))
        .filter(b => {
          const expiresAt = b.expiresAt?.toMillis ? b.expiresAt.toMillis() : 0;
          return expiresAt > now && b.remainingAmount > 0 && b.claimedBy.length < b.recipientsLimit;
        });
      setActiveBags(bags);
    });

    return () => unsubscribe();
  }, [initialRoom.id]);

  const sanitizeSpeakers = (speakers: any[]) => {
    return (speakers || []).map(s => ({
      id: s.id || '',
      customId: s.customId || null,
      name: s.name || 'مستخدم',
      avatar: s.avatar || '', 
      seatIndex: Number(s.seatIndex) ?? 0,
      isMuted: !!s.isMuted,
      charm: Number(s.charm || 0),
      activeEmoji: s.activeEmoji || null,
      frame: s.frame || null
    }));
  };

  const queueRoomSpeakersUpdate = useCallback((updatedSpeakers: any[], updatedMicCount?: number) => {
    pendingRoomSpeakers.current = sanitizeSpeakers(updatedSpeakers);
    const mCount = updatedMicCount || localMicCount;
    if (roomSyncTimerRef.current) clearTimeout(roomSyncTimerRef.current);
    roomSyncTimerRef.current = setTimeout(async () => {
      if (pendingRoomSpeakers.current) {
        try {
          await updateDoc(doc(db, 'rooms', initialRoom.id), { 
            speakers: pendingRoomSpeakers.current,
            micCount: mCount
          });
        } catch (e) {}
        pendingRoomSpeakers.current = null;
      }
      roomSyncTimerRef.current = null;
    }, 2500); 
  }, [initialRoom.id, localMicCount]);

  // إدارة مؤقت اختفاء زر الكومبو
  const startComboExpiryTimer = useCallback(() => {
    if (comboExpireTimerRef.current) clearTimeout(comboExpireTimerRef.current);
    comboExpireTimerRef.current = setTimeout(() => {
      setComboState(null);
    }, 5000); // 5 ثواني كما هو مطلوب
  }, []);

  // تنفيذ الأوامر الإدارية من البروفايل
  const handleAdminActionFromProfile = async (action: string, targetUser: User) => {
    if (!canAdmin) return;
    const roomRef = doc(db, 'rooms', initialRoom.id);

    switch (action) {
      case 'addModerator':
        if (!isHost) return;
        await updateDoc(roomRef, { moderators: arrayUnion(targetUser.id) });
        alert(`تم تعيين ${targetUser.name} مشرفاً دايماً ✅`);
        break;
      case 'removeModerator':
        if (!isHost) return;
        await updateDoc(roomRef, { moderators: arrayRemove(targetUser.id) });
        alert(`تم سحب الإشراف من ${targetUser.name} ❌`);
        break;
      case 'removeMic':
        const updatedAfterMicRemove = localSpeakers.filter(s => s.id !== targetUser.id);
        setLocalSpeakers(updatedAfterMicRemove);
        queueRoomSpeakersUpdate(updatedAfterMicRemove);
        alert(`تم إنزال ${targetUser.name} من المايك ✅`);
        break;
      case 'kickAndBan':
        // حظر دائم من الغرفة وتنزيله من المايك
        const updatedAfterKick = localSpeakers.filter(s => s.id !== targetUser.id);
        setLocalSpeakers(updatedAfterKick);
        await updateDoc(roomRef, { 
          kickedUsers: arrayUnion(targetUser.id),
          speakers: updatedAfterKick
        });
        alert(`تم طرد وحظر ${targetUser.name} من الغرفة نهائياً ✅`);
        break;
      case 'resetUserCharm':
        const updatedAfterCharmReset = localSpeakers.map(s => s.id === targetUser.id ? { ...s, charm: 0 } : s);
        setLocalSpeakers(updatedAfterCharmReset);
        queueRoomSpeakersUpdate(updatedAfterCharmReset);
        alert(`تم تصفير كاريزما ${targetUser.name} بنجاح ✅`);
        break;
    }
  };

  const handleSeatClick = (index: number) => {
    const s = localSpeakers.find(s => s.seatIndex === index);
    if (s) { setSelectedUserForProfile(s); setShowProfileSheet(true); }
    else {
      if (room.kickedUsers?.includes(currentUser.id)) return;
      const newSpeaker = { 
        id: currentUser.id, 
        customId: currentUser.customId,
        name: currentUser.name, 
        avatar: currentUser.avatar, 
        seatIndex: index, 
        isMuted, 
        charm: (localSpeakers.find(s => s.id === currentUser.id)?.charm || 0), 
        activeEmoji: null, 
        frame: currentUser.frame || null 
      };
      const updated = [...localSpeakers.filter(s => s.id !== currentUser.id), newSpeaker];
      setLocalSpeakers(updated);
      queueRoomSpeakersUpdate(updated);
    }
  };

  const handleSendGift = (gift: Gift, quantity: number) => {
    if (selectedRecipientIds.length === 0) return alert('اختر مستلماً أولاً');
    setShowGifts(false);
    if (executeGiftSendOptimistic(gift, quantity, selectedRecipientIds, false)) {
      setComboState({ gift, recipients: [...selectedRecipientIds], count: quantity });
      startComboExpiryTimer(); // بدء مؤقت الاختفاء
    }
  };

  const executeGiftSendOptimistic = (gift: Gift, quantity: number, recipientIds: string[], isComboHit: boolean = false) => {
    const totalCost = gift.cost * quantity * recipientIds.length;
    const giftValuePerRecipient = gift.cost * quantity;
    if (Number(currentUser.coins || 0) < totalCost) { alert('رصيدك لا يكفي!'); return false; }
    if (giftAnimRef.current) {
      giftAnimRef.current.trigger({ id: 'local-' + Date.now(), giftId: gift.id, giftName: gift.name, giftIcon: gift.icon, giftAnimation: gift.animationType || 'pop', senderId: currentUser.id, senderName: currentUser.name, senderAvatar: currentUser.avatar, recipientIds, quantity, duration: gift.duration || 5, displaySize: gift.displaySize || 'medium', timestamp: Timestamp.now() });
    }
    let winAmount = 0;
    if (gift.isLucky || gift.category === 'lucky') {
      const isWin = (Math.random() * 100) < (gameSettings.luckyGiftWinRate || 30);
      if (isWin && gameSettings.luckyMultipliers?.length > 0) {
        const picked = pickLuckyMultiplier(gameSettings.luckyMultipliers);
        winAmount = gift.cost * quantity * picked.value;
      }
    }
    onUpdateUser({ coins: Number(currentUser.coins) - totalCost + winAmount, wealth: Number(currentUser.wealth || 0) + totalCost });
    const updatedSpeakers = localSpeakers.map((s: any) => { if (recipientIds.includes(s.id)) return { ...s, charm: (Number(s.charm) || 0) + giftValuePerRecipient }; return s; });
    setLocalSpeakers(updatedSpeakers);
    if (winAmount > 0) { setLuckyWinAmount(winAmount); setTimeout(() => setLuckyWinAmount(0), 6000); }
    if (isComboHit) {
      if (!pendingSyncData.current) pendingSyncData.current = { giftId: gift.id, count: 0, recipients: recipientIds, totalCost: 0, totalWin: 0 };
      pendingSyncData.current.count += quantity; pendingSyncData.current.totalCost += totalCost; pendingSyncData.current.totalWin += winAmount;
      if (comboSyncTimerRef.current) clearTimeout(comboSyncTimerRef.current);
      comboSyncTimerRef.current = setTimeout(() => commitPendingSync(gift), 3000); 
    } else { setTimeout(() => commitSingleGift(gift, quantity, recipientIds, totalCost, winAmount, updatedSpeakers), 0); }
    return true;
  };

  const pickLuckyMultiplier = (multipliers: LuckyMultiplier[]) => {
    const totalChance = multipliers.reduce((sum, m) => sum + m.chance, 0);
    let random = Math.random() * totalChance;
    for (const m of multipliers) { if (random < m.chance) return m; random -= m.chance; }
    return multipliers[0];
  };

  const commitPendingSync = (gift: Gift) => {
    if (!pendingSyncData.current) return;
    const data = pendingSyncData.current; pendingSyncData.current = null;
    commitSingleGift(gift, data.count, data.recipients, data.totalCost, data.totalWin, localSpeakers);
  };

  const commitSingleGift = (gift: Gift, qty: number, recIds: string[], cost: number, win: number, speakers: any[]) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', currentUser.id), { coins: increment(-cost + win), wealth: increment(cost) });
    recIds.forEach(rid => {
      const recipientUser = users.find((u: User) => u.id === rid);
      const hostAgencyId = recipientUser?.hostAgencyId;
      const valuePerRecipient = (gift.cost * qty);
      const earnings = valuePerRecipient * 0.7;
      batch.update(doc(db, 'users', rid), { charm: increment(valuePerRecipient), diamonds: increment(earnings), ...(hostAgencyId ? { hostProduction: increment(earnings) } : {}) });
      if (hostAgencyId) batch.update(doc(db, 'host_agencies', hostAgencyId), { totalProduction: increment(earnings) });
      batch.set(doc(db, 'rooms', initialRoom.id, 'contributors', currentUser.id), { userId: currentUser.id, name: currentUser.name, avatar: currentUser.avatar, amount: increment(valuePerRecipient) }, { merge: true });
    });
    batch.set(doc(collection(db, 'rooms', initialRoom.id, 'gift_events')), { giftId: gift.id, giftName: gift.name, giftIcon: gift.icon, giftAnimation: gift.animationType || 'pop', senderId: currentUser.id, senderName: currentUser.name, recipientIds: recIds, quantity: qty, duration: gift.duration || 5, displaySize: gift.displaySize || 'medium', timestamp: serverTimestamp() });
    if (win >= 10000 || cost >= 10000) {
      batch.set(doc(collection(db, 'global_announcements')), { senderId: currentUser.id, senderName: currentUser.name, giftName: gift.name, giftIcon: (gift.catalogIcon || gift.icon), recipientName: recIds.length > 1 ? `${recIds.length} مستخدمين` : (users.find((u: User) => u.id === recIds[0])?.name || 'مستخدم'), roomTitle: initialRoom.title, roomId: initialRoom.id, amount: win >= 10000 ? win : cost, type: win >= 10000 ? 'lucky_win' : 'gift', timestamp: serverTimestamp() });
    }
    const wealthLvl = calculateLiveLvl(Number(currentUser.wealth || 0) + cost);
    batch.set(doc(collection(db, 'rooms', initialRoom.id, 'messages')), { userId: currentUser.id, userName: currentUser.name, userWealthLevel: wealthLvl, userRechargeLevel: calculateLiveLvl(Number(currentUser.rechargePoints || 0)), content: win > 0 ? `أرسل ${gift.name} x${qty} وفاز بـ ${win.toLocaleString()} 🪙!` : `أرسل ${gift.name} x${qty} 🎁`, type: 'gift', isLuckyWin: win > 0, timestamp: serverTimestamp() });
    batch.commit(); queueRoomSpeakersUpdate(speakers);
  };

  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    addDoc(collection(db, 'rooms', initialRoom.id, 'messages'), { userId: currentUser.id, userName: currentUser.name, userWealthLevel: calculateLiveLvl(Number(currentUser.wealth || 0)), userRechargeLevel: calculateLiveLvl(Number(currentUser.rechargePoints || 0)), userAchievements: currentUser.achievements || [], userBubble: currentUser.activeBubble || null, userVip: currentUser.isVip || false, content: text, type: 'text', timestamp: serverTimestamp() });
  };

  const handleSendEmoji = async (emoji: string) => {
    const onMic = localSpeakers.find((s: any) => s.id === currentUser.id);
    if (!onMic) return;
    if (emojiTimerRef.current) clearTimeout(emojiTimerRef.current);
    const updated = localSpeakers.map((s: any) => s.id === currentUser.id ? { ...s, activeEmoji: emoji } : s);
    setLocalSpeakers(updated); queueRoomSpeakersUpdate(updated);
    emojiTimerRef.current = setTimeout(() => {
      const cleared = localSpeakers.map((s: any) => s.id === currentUser.id ? { ...s, activeEmoji: null } : s);
      setLocalSpeakers(cleared); queueRoomSpeakersUpdate(cleared);
    }, (gameSettings.emojiDuration || 4) * 1000);
  };

  const handleToolAction = async (action: string) => {
    setShowTools(false);
    if (action === 'settings') setShowSettings(true);
    else if (action === 'rank') setShowRank(true);
    else if (action === 'luckybag') setShowLuckyBag(true);
    else if (action === 'mic_layout') {
      const layouts = [8, 10, 15, 20];
      const next = layouts[(layouts.indexOf(localMicCount) + 1) % layouts.length];
      setLocalMicCount(next);
      const filtered = localSpeakers.filter(s => Number(s.seatIndex) < next);
      setLocalSpeakers(filtered); queueRoomSpeakersUpdate(filtered, next);
    } else if (action === 'clear_chat') {
      if (!confirm('مسح الدردشة؟')) return;
      const snap = await getDocs(collection(db, 'rooms', initialRoom.id, 'messages'));
      const batch = writeBatch(db); snap.forEach(d => batch.delete(d.ref)); await batch.commit();
    } else if (action === 'reset_charm') {
      if (!confirm('تصفير كاريزما الغرفة؟')) return;
      const updated = localSpeakers.map(s => ({ ...s, charm: 0 }));
      setLocalSpeakers(updated); queueRoomSpeakersUpdate(updated);
      const snap = await getDocs(collection(db, 'rooms', initialRoom.id, 'contributors'));
      const batch = writeBatch(db); snap.forEach(d => batch.delete(d.ref)); await batch.commit();
    }
  };

  const handleSendLuckyBag = async (amount: number, recipients: number) => {
    if (Number(currentUser.coins) < amount) return;

    try {
      const bagId = 'bag_' + Date.now();
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 5);

      const bagData = {
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderAvatar: currentUser.avatar,
        roomId: initialRoom.id,
        roomTitle: initialRoom.title,
        totalAmount: amount,
        remainingAmount: amount,
        recipientsLimit: recipients,
        claimedBy: [],
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt)
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'lucky_bags', bagId), bagData);
      batch.update(doc(db, 'users', currentUser.id), { coins: increment(-amount), wealth: increment(amount) });
      batch.set(doc(collection(db, 'rooms', initialRoom.id, 'messages')), { userId: currentUser.id, userName: currentUser.name, content: `أطلق حقيبة حظ بقيمة ${amount.toLocaleString()} 🪙!`, type: 'text', isLuckyWin: true, timestamp: serverTimestamp() });
      batch.set(doc(collection(db, 'global_announcements')), { senderId: currentUser.id, senderName: currentUser.name, roomTitle: initialRoom.title, roomId: initialRoom.id, amount: amount, type: 'lucky_bag', timestamp: serverTimestamp() });
      await batch.commit();
      
      onUpdateUser({ coins: Number(currentUser.coins) - amount, wealth: Number(currentUser.wealth || 0) + amount });
      setShowLuckyBag(false);
    } catch (e) { alert('فشل إطلاق الحقيبة'); }
  };

  const handleClaimBag = async (bag: LuckyBag) => {
    if (bag.claimedBy.includes(currentUser.id)) return;
    try {
      const share = Math.floor(bag.totalAmount / bag.recipientsLimit);
      const batch = writeBatch(db);
      batch.update(doc(db, 'lucky_bags', bag.id), { claimedBy: arrayUnion(currentUser.id), remainingAmount: increment(-share) });
      batch.update(doc(db, 'users', currentUser.id), { coins: increment(share) });
      await batch.commit();
      onUpdateUser({ coins: Number(currentUser.coins) + share });
      alert(`مبروك! ربحت ${share.toLocaleString()} كوينز 💰`);
    } catch (e) { alert('فشل الاستلام'); }
  };

  const currentSkin = micSkins[String(localMicCount)] || undefined;
  const seats = Array.from({ length: localMicCount }).map((_, i) => localSpeakers.find(s => s.seatIndex === i) || null);

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-slate-950 font-cairo overflow-hidden text-right">
      <RoomBackground background={room.background} />
      
      <GiftAnimationLayer ref={giftAnimRef} roomId={initialRoom.id} speakers={localSpeakers} currentUserId={currentUser.id} onActiveChange={setIsGiftActive} />
      <EntryAnimationLayer roomId={initialRoom.id} currentUserId={currentUser.id} onActiveChange={setIsEntryActive} />
      
      <RoomHeader room={room} onLeave={onLeave} onMinimize={onMinimize} onShowParticipants={() => setShowParticipants(true)} />
      
      <AnimatePresence>
        {luckyWinAmount > 0 && <WinStrip amount={luckyWinAmount} />}
        {activeBags.map(bag => ( <LuckyBagActive key={bag.id} bag={bag as any} isClaimed={bag.claimedBy.includes(currentUser.id)} onClaim={() => handleClaimBag(bag)} /> ))}
      </AnimatePresence>

      <div className="flex-1 relative flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col justify-center items-center px-4 py-4 overflow-visible">
          {localMicCount === 10 ? (
            <div className="flex flex-col gap-y-9 items-center w-full max-w-sm mx-auto overflow-visible">
              <div className="flex justify-center gap-6 overflow-visible">{seats.slice(0, 2).map((s, i) => (<Seat key={i} index={i} speaker={s} isHost={s?.id === room.hostId} currentUser={currentUser} sizeClass="w-14 h-14" customSkin={currentSkin} onClick={() => handleSeatClick(i)} />))}</div>
              <div className="grid grid-cols-4 gap-4 w-full justify-items-center overflow-visible">{seats.slice(2, 6).map((s, i) => (<Seat key={i+2} index={i+2} speaker={s} isHost={s?.id === room.hostId} currentUser={currentUser} sizeClass="w-14 h-14" customSkin={currentSkin} onClick={() => handleSeatClick(i+2)} />))}</div>
              <div className="grid grid-cols-4 gap-4 w-full justify-items-center overflow-visible">{seats.slice(6, 10).map((s, i) => (<Seat key={i+6} index={i+6} speaker={s} isHost={s?.id === room.hostId} currentUser={currentUser} sizeClass="w-14 h-14" customSkin={currentSkin} onClick={() => handleSeatClick(i+6)} />))}</div>
            </div>
          ) : (
            <div className={`grid ${localMicCount === 20 ? 'grid-cols-5' : localMicCount === 15 ? 'grid-cols-5' : 'grid-cols-4'} gap-x-4 gap-y-12 w-full max-w-sm mx-auto justify-items-center items-center overflow-visible`}>
              {seats.map((s, i) => (<Seat key={i} index={i} speaker={s} isHost={s?.id === room.hostId} currentUser={currentUser} sizeClass={localMicCount === 20 ? 'w-11 h-11' : localMicCount === 15 ? 'w-[52px] h-[52px]' : 'w-[72px] h-[72px]'} customSkin={currentSkin} onClick={() => handleSeatClick(i)} />))}
            </div>
          )}
        </div>
        
        <div className="h-64 px-4 mb-4 overflow-hidden relative z-[60]" dir="rtl">
           <div ref={chatContainerRef} className="h-full overflow-y-auto scrollbar-hide space-y-4 flex flex-col pb-4 pointer-events-auto touch-pan-y">
              <div className="flex-1" />
              {messages.map((msg) => (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={msg.id} className="flex items-start gap-2">
                   <div className="flex flex-col items-start">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                         <ChatLevelBadge level={msg.userWealthLevel || 1} type="wealth" />
                         <ChatLevelBadge level={msg.userRechargeLevel || 1} type="recharge" />
                         <span className={`text-[12px] font-black drop-shadow-lg shrink-0 ${msg.userVip ? 'text-amber-400' : 'text-blue-300'}`}>{msg.userName}</span>
                         <div className="flex items-center gap-1 mr-1">{msg.userAchievements?.slice(0, 5).map((medal: string, idx: number) => (<img key={idx} src={medal} className="w-8 h-8 object-contain filter drop-shadow-md brightness-110" alt="medal" />))}</div>
                      </div>
                      <div className={`relative min-h-[42px] w-fit max-w-[260px] px-7 py-3 flex items-center justify-center text-center shadow-2xl ${msg.isLuckyWin ? 'bg-gradient-to-r from-amber-600/40 to-yellow-500/40 border border-amber-500/50 rounded-2xl' : !msg.userBubble ? 'bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl rounded-tr-none' : ''}`} style={msg.userBubble ? { backgroundImage: `url(${msg.userBubble})`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', minWidth: '95px' } : {}}>
                         <p className={`text-[13px] font-black text-white leading-relaxed break-words drop-shadow-0_1px_3px_rgba(0,0,0,0.8) ${msg.isLuckyWin ? 'text-yellow-200' : ''}`}>{msg.content}</p>
                      </div>
                   </div>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
           </div>
        </div>
        
        <AnimatePresence>
          {comboState && (
            <ComboButton 
              gift={comboState.gift} 
              count={comboState.count} 
              onHit={() => { 
                setComboState(p => p ? { ...p, count: p.count + 1 } : null); 
                executeGiftSendOptimistic(comboState.gift, 1, comboState.recipients, true); 
                startComboExpiryTimer(); // إعادة تعيين المؤقت عند الضغط
              }} 
              duration={5000} 
            />
          )}
        </AnimatePresence>
        <ControlBar isMuted={isMuted} onToggleMute={onToggleMute} onShowGifts={() => setShowGifts(true)} onShowGames={() => setShowGameCenter(true)} onShowRoomTools={() => setShowTools(true)} onSendMessage={handleSendMessage} onShowEmojis={() => setShowEmojis(true)} userCoins={Number(currentUser.coins)} />
      </div>

      <ReactionPicker isOpen={showEmojis} emojis={gameSettings.availableEmojis} onSelect={(emoji) => { handleSendEmoji(emoji); setShowEmojis(false); }} onClose={() => setShowEmojis(false)} />
      <GiftModal isOpen={showGifts} onClose={() => setShowGifts(false)} gifts={gifts} userCoins={Number(currentUser.coins)} speakers={localSpeakers} selectedRecipientIds={selectedRecipientIds} onSelectRecipient={setSelectedRecipientIds} onSend={handleSendGift} categoryLabels={giftCategoryLabels} />
      <RoomToolsModal isOpen={showTools} onClose={() => setShowTools(false)} isHost={canAdmin} onAction={handleToolAction} />
      {showSettings && <RoomSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} room={room} onUpdate={onUpdateRoom} />}
      {showRank && <RoomRankModal isOpen={showRank} onClose={() => setShowRank(false)} roomId={initialRoom.id} roomTitle={room.title} />}
      {showLuckyBag && <LuckyBagModal isOpen={showLuckyBag} onClose={() => setShowLuckyBag(false)} userCoins={Number(currentUser.coins)} onSend={handleSendLuckyBag} />}
      <GameCenterModal isOpen={showGameCenter} onClose={() => setShowGameCenter(false)} onSelectGame={(game) => { setActiveGame(game); setShowGameCenter(false); }} />
      
      {activeGame === 'wheel' && <WheelGameModal isOpen={activeGame === 'wheel'} onClose={() => setActiveGame(null)} userCoins={Number(currentUser.coins)} onUpdateCoins={(c) => onUpdateUser({ coins: c })} winRate={gameSettings.wheelWinRate} gameSettings={gameSettings} />}
      {activeGame === 'slots' && <SlotsGameModal isOpen={activeGame === 'slots'} onClose={() => setActiveGame(null)} userCoins={Number(currentUser.coins)} onUpdateCoins={(c) => onUpdateUser({ coins: c })} winRate={gameSettings.slotsWinRate} gameSettings={gameSettings} />}
      {activeGame === 'lion' && <LionWheelGameModal isOpen={activeGame === 'lion'} onClose={() => setActiveGame(null)} userCoins={Number(currentUser.coins)} onUpdateCoins={(c) => onUpdateUser({ coins: c })} gameSettings={gameSettings} />}

      <AnimatePresence>{showProfileSheet && selectedUserForProfile && (<UserProfileSheet user={selectedUserForProfile} onClose={() => setShowProfileSheet(false)} isCurrentUser={selectedUserForProfile.id === currentUser.id} onAction={(action) => { if (action === 'gift') setShowGifts(true); if (action === 'message') onOpenPrivateChat(selectedUserForProfile); if (action === 'edit') setShowEditProfileModal(true); handleAdminActionFromProfile(action, selectedUserForProfile); }} currentUser={currentUser} allUsers={users} currentRoom={room} />)}</AnimatePresence>
      <AnimatePresence>{showEditProfileModal && <EditProfileModal isOpen={showEditProfileModal} onClose={() => setShowEditProfileModal(false)} currentUser={currentUser} onSave={onUpdateUser} />}</AnimatePresence>
      <AnimatePresence>{showParticipants && ( <RoomParticipantsModal isOpen={showParticipants} onClose={() => setShowParticipants(false)} participants={roomParticipants} onSelectUser={(u) => { setSelectedUserForProfile(u); setShowProfileSheet(true); }} /> )}</AnimatePresence>
    </div>
  );
};
export default VoiceRoom;
