import { db } from './firebase.js';
import {
  doc, setDoc, collection, getDocs, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export async function getMemberWeekData(weekId, memberId) {
  const daysRef = collection(db, 'weeks', weekId, 'members', memberId, 'days');
  const snapshot = await getDocs(daysRef);
  const result = {};
  snapshot.forEach(d => { result[d.id] = d.data(); });
  return result;
}

export async function saveMemberWeekData(weekId, memberId, daysData) {
  const writes = [];
  for (const [date, data] of Object.entries(daysData)) {
    const dayRef = doc(db, 'weeks', weekId, 'members', memberId, 'days', date);
    writes.push(setDoc(dayRef, data));
  }
  const memberRef = doc(db, 'weeks', weekId, 'members', memberId);
  writes.push(setDoc(memberRef, { updatedAt: serverTimestamp() }, { merge: true }));
  await Promise.all(writes);
}

export function watchWeekStatus(weekId, callback) {
  const membersRef = collection(db, 'weeks', weekId, 'members');
  return onSnapshot(membersRef, snapshot => {
    const filled = snapshot.docs.map(d => d.id);
    callback(filled);
  });
}

export async function getFullWeekData(weekId) {
  const membersRef = collection(db, 'weeks', weekId, 'members');
  const membersSnap = await getDocs(membersRef);
  const result = {};
  await Promise.all(membersSnap.docs.map(async memberDoc => {
    const memberId = memberDoc.id;
    const daysRef = collection(db, 'weeks', weekId, 'members', memberId, 'days');
    const daysSnap = await getDocs(daysRef);
    result[memberId] = {};
    daysSnap.forEach(d => { result[memberId][d.id] = d.data(); });
  }));
  return result;
}
