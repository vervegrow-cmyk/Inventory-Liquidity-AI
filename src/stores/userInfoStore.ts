import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserInfoState {
  userName: string;
  contact: string;
  address: string;
  setUserInfo: (info: Partial<Pick<UserInfoState, 'userName' | 'contact' | 'address'>>) => void;
  hasInfo: () => boolean;
}

export const useUserInfoStore = create<UserInfoState>()(
  persist(
    (set, get) => ({
      userName: '',
      contact: '',
      address: '',
      setUserInfo: (info) => set((s) => ({ ...s, ...info })),
      hasInfo: () => {
        const s = get();
        return !!(s.userName.trim() && s.contact.trim());
      },
    }),
    { name: 'user-info-v1' }
  )
);
