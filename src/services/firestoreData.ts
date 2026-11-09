import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase.ts';
import { Channel, FeaturedEvent, Category, Announcement, AppSettings } from '../types/index.ts';
import {
  INITIAL_CHANNELS,
  INITIAL_EVENTS,
  INITIAL_CATEGORIES,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_SETTINGS,
} from '../data/seedData.ts';
import { isAdminEmailAuthorized } from '../utils/channels.ts';

export async function getFirestoreChannels(): Promise<Channel[]> {
  try {
    const snap = await getDocs(collection(db, 'channels'));
    if (snap.empty) {
      return [];
    }
    return snap.docs.map((d) => d.data() as Channel);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'channels');
  }
}

export async function getFirestoreEvents(): Promise<FeaturedEvent[]> {
  try {
    const snap = await getDocs(collection(db, 'events'));
    if (snap.empty) {
      return [];
    }
    return snap.docs.map((d) => d.data() as FeaturedEvent);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'events');
  }
}

export async function getFirestoreCategories(): Promise<Category[]> {
  try {
    const snap = await getDocs(collection(db, 'categories'));
    if (snap.empty) {
      return [];
    }
    return snap.docs.map((d) => d.data() as Category);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'categories');
  }
}

export async function getFirestoreAnnouncements(): Promise<Announcement[]> {
  try {
    const snap = await getDocs(collection(db, 'announcements'));
    if (snap.empty) {
      return [];
    }
    return snap.docs.map((d) => d.data() as Announcement);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'announcements');
  }
}

export async function getFirestoreSettings(): Promise<AppSettings | null> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'public'));
    if (snap.exists()) {
      return snap.data() as AppSettings;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'settings/public');
  }
}

function isFirebaseAdminReady(): boolean {
  return Boolean(auth.currentUser && isAdminEmailAuthorized(auth.currentUser.email));
}

export async function syncChannelToFirestore(channel: Channel): Promise<void> {
  if (!isFirebaseAdminReady()) return;
  try {
    await setDoc(doc(db, 'channels', channel.id), channel);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `channels/${channel.id}`);
  }
}

export async function deleteChannelFromFirestore(channelId: string): Promise<void> {
  if (!isFirebaseAdminReady()) return;
  try {
    await deleteDoc(doc(db, 'channels', channelId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `channels/${channelId}`);
  }
}

export async function syncEventToFirestore(event: FeaturedEvent): Promise<void> {
  if (!isFirebaseAdminReady()) return;
  try {
    await setDoc(doc(db, 'events', event.id), event);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `events/${event.id}`);
  }
}

export async function deleteEventFromFirestore(eventId: string): Promise<void> {
  if (!isFirebaseAdminReady()) return;
  try {
    await deleteDoc(doc(db, 'events', eventId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `events/${eventId}`);
  }
}

export async function syncCategoryToFirestore(category: Category): Promise<void> {
  if (!isFirebaseAdminReady()) return;
  try {
    await setDoc(doc(db, 'categories', category.id), category);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `categories/${category.id}`);
  }
}

export async function syncAnnouncementToFirestore(announcement: Announcement): Promise<void> {
  if (!isFirebaseAdminReady()) return;
  try {
    await setDoc(doc(db, 'announcements', announcement.id), announcement);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `announcements/${announcement.id}`);
  }
}

export async function syncSettingsToFirestore(settings: AppSettings): Promise<void> {
  if (!isFirebaseAdminReady()) return;
  try {
    await setDoc(doc(db, 'settings', 'public'), settings);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/public');
  }
}

/**
 * Bootstraps initial database records into Firestore when the authorized admin signs in
 */
export async function bootstrapFirestoreDatabase(): Promise<void> {
  if (!isFirebaseAdminReady()) return;
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'public'));
    if (!settingsDoc.exists()) {
      await setDoc(doc(db, 'settings', 'public'), INITIAL_SETTINGS);
    }

    const eventsSnap = await getDocs(collection(db, 'events'));
    if (eventsSnap.empty) {
      for (const ev of INITIAL_EVENTS) {
        await setDoc(doc(db, 'events', ev.id), ev);
      }
    }

    const catSnap = await getDocs(collection(db, 'categories'));
    if (catSnap.empty) {
      for (const cat of INITIAL_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), cat);
      }
    }

    const annSnap = await getDocs(collection(db, 'announcements'));
    if (annSnap.empty) {
      for (const ann of INITIAL_ANNOUNCEMENTS) {
        await setDoc(doc(db, 'announcements', ann.id), ann);
      }
    }

    const channelsSnap = await getDocs(collection(db, 'channels'));
    if (channelsSnap.empty) {
      for (const ch of INITIAL_CHANNELS.slice(0, 25)) {
        await setDoc(doc(db, 'channels', ch.id), ch);
      }
    }
  } catch (err) {
    console.warn('Firestore bootstrap notice:', err);
  }
}
