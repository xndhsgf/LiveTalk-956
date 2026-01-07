
import { db } from './firebase';
import { doc, updateDoc, increment, writeBatch, arrayUnion } from 'firebase/firestore';

/**
 * محرك الاقتصاد الموحد - لايف توك (النسخة الاحترافية الموثوقة)
 */

export const EconomyEngine = {
  
  // 1. صرف كوينز (هدايا، ألعاب، متجر) مع تحديث الثروة
  spendCoins: async (userId: string, currentCoins: any, currentWealth: any, amount: any, currentOwnedItems: string[], itemId: string | null, updateLocalState: (data: any) => void) => {
    const coins = Number(currentCoins || 0);
    const wealth = Number(currentWealth || 0);
    const cost = Number(amount || 0);

    if (cost <= 0 || coins < cost) return false;
    
    const updateData: any = { coins: coins - cost, wealth: wealth + cost };
    if (itemId && !currentOwnedItems.includes(itemId)) {
      updateData.ownedItems = [...(currentOwnedItems || []), itemId];
    }
    updateLocalState(updateData);

    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', userId);
      const remoteUpdate: any = { coins: increment(-cost), wealth: increment(cost) };
      if (itemId) remoteUpdate.ownedItems = arrayUnion(itemId);
      batch.update(userRef, remoteUpdate);
      await batch.commit();
      return true;
    } catch (e) { return false; }
  },

  // 2. شراء رتبة VIP وحفظ الإطار فوراً
  buyVIP: async (userId: string, currentCoins: any, currentWealth: any, vip: any, updateLocalState: (data: any) => void) => {
    const coins = Number(currentCoins || 0);
    const cost = Number(vip.cost || 0);
    if (coins < cost) return false;
    const updateData = { isVip: true, vipLevel: vip.level, coins: coins - cost, wealth: Number(currentWealth || 0) + cost, frame: vip.frameUrl };
    updateLocalState(updateData);
    try {
      await updateDoc(doc(db, 'users', userId), { isVip: true, vipLevel: vip.level, coins: increment(-cost), wealth: increment(cost), frame: vip.frameUrl });
      return true;
    } catch (e) { return false; }
  },

  // 3. تحويل الألماس لكوينز (شخصي) - نسبة 50%
  exchangeDiamonds: async (userId: string, currentCoins: any, currentDiamonds: any, amount: any, updateLocalState: (data: any) => void) => {
    const cost = Number(amount || 0);
    const diamonds = Number(currentDiamonds || 0);
    if (cost <= 0 || diamonds < cost) return false;
    const coinsGained = Math.floor(cost * 0.5);
    updateLocalState({ coins: Number(currentCoins || 0) + coinsGained, diamonds: diamonds - cost });
    try {
      await updateDoc(doc(db, 'users', userId), { coins: increment(coinsGained), diamonds: increment(-cost) });
      return true;
    } catch (e) { return false; }
  },

  // 4. تحويل الراتب لوكيل شحن (الميزة الجديدة)
  // المعادلة: 70,000 راتب = 80,000 رصيد وكالة
  exchangeSalaryToAgency: async (senderId: string, currentDiamonds: number, agentId: string, amount: number, updateLocalState: (data: any) => void) => {
    if (amount < 70000 || currentDiamonds < amount) return false;

    // حساب كم سيحصل الوكيل (كل 70 ألف ألماس تعطي 80 ألف كوينز في رصيد الوكالة)
    const agencyCoinsGained = Math.floor((amount / 70000) * 80000);

    try {
      const batch = writeBatch(db);
      // خصم من المرسل (الراتب الماسي)
      batch.update(doc(db, 'users', senderId), { diamonds: increment(-amount) });
      // إضافة للوكيل (رصيد الوكالة المخصص للشحن)
      batch.update(doc(db, 'users', agentId), { agencyBalance: increment(agencyCoinsGained) });
      
      await batch.commit();
      updateLocalState({ diamonds: currentDiamonds - amount });
      return true;
    } catch (e) {
      console.error("Exchange Error:", e);
      return false;
    }
  },

  // 5. شحن الوكالات (من وكيل لمستخدم)
  agencyTransfer: async (agentId: string, currentAgentBalance: any, targetId: string, currentTargetCoins: any, currentTargetPoints: any, amount: any, updateLocalState: (agentData: any, targetData: any) => void) => {
    const transferAmt = Number(amount || 0);
    const agentBalance = Number(currentAgentBalance || 0);
    if (transferAmt <= 0 || agentBalance < transferAmt) return false;
    updateLocalState({ agencyBalance: agentBalance - transferAmt }, { coins: Number(currentTargetCoins || 0) + transferAmt, rechargePoints: Number(currentTargetPoints || 0) + transferAmt });
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', agentId), { agencyBalance: increment(-transferAmt) });
      batch.update(doc(db, 'users', targetId), { coins: increment(transferAmt), rechargePoints: increment(transferAmt) });
      await batch.commit();
      return true;
    } catch (e) { return false; }
  }
};
