import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import { User as FirebaseUser } from 'firebase/auth';

export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  photoURL: string | null;
}

export const userService = {
  async syncUserProfile(user: FirebaseUser): Promise<UserProfile> {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data() as UserProfile;
      // Update profile if changed (except role)
      if (data.displayName !== user.displayName || data.photoURL !== user.photoURL) {
        await updateDoc(userRef, {
          displayName: user.displayName,
          photoURL: user.photoURL
        });
      }
      return { ...data, displayName: user.displayName, photoURL: user.photoURL };
    } else {
      // Create new profile
      const isDefaultAdmin = user.email === 'rob47595@gmail.com';
      const newProfile: UserProfile = {
        uid: user.uid,
        email: user.email || '',
        role: isDefaultAdmin ? 'admin' : 'user',
        displayName: user.displayName,
        photoURL: user.photoURL
      };
      await setDoc(userRef, newProfile);
      return newProfile;
    }
  },

  async getAllUsers(): Promise<UserProfile[]> {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, orderBy('email'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as UserProfile);
  },

  async updateUserRole(uid: string, role: UserRole): Promise<void> {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, { role });
  }
};
