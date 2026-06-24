import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ── Types ────────────────────────────────────────────────────────────────────
export interface Profile {
  user_id: string;
  display_name: string;
  email?: string;
  phone?: string;
  age?: number;
  attempt?: number;
  optional_subject?: string;
  optional_subject_custom?: string;
  features_enabled?: FeatureGates;
  is_locked?: boolean;
  is_admin?: boolean;
  created_at?: string;
}

export interface FeatureGates {
  focus?: boolean;
  plans?: boolean;
  ai_chat?: boolean;
  pyq?: boolean;
  sources?: boolean;
}

export interface ProfileFormData {
  display_name: string;
  age: number;
  attempt: number;
  phone: string;
  optional_subject: string;
  optional_subject_custom: string;
}

const DEFAULT_FEATURES: FeatureGates = {
  focus: true,
  plans: true,
  ai_chat: false,
  pyq: true,
  sources: true,
};

const SUPERUSER_FEATURES: FeatureGates = {
  focus: true,
  plans: true,
  ai_chat: true,
  pyq: true,
  sources: true,
};

const OPTIONAL_SUBJECTS = [
  'Anthropology',
  'Geography',
  'Public Administration',
  'Sociology',
  'History',
  'Political Science & IR',
  'Philosophy',
  'Law',
] as const;

// ── Validation ───────────────────────────────────────────────────────────────
export interface ProfileErrors {
  name?: string;
  age?: string;
  attempt?: string;
  phone?: string;
}

export function validateProfile(data: ProfileFormData): ProfileErrors {
  const errors: ProfileErrors = {};
  if (!data.display_name || data.display_name.length < 2 || !/^[A-Za-z][A-Za-z\s.'-]{1,49}$/.test(data.display_name)) {
    errors.name = 'Enter a valid name (letters, spaces, 2-50 chars)';
  }
  if (!data.age || data.age < 16 || data.age > 45) {
    errors.age = 'Age must be 16-45';
  }
  if (!data.attempt || data.attempt < 1 || data.attempt > 10) {
    errors.attempt = 'Attempt must be 1-10';
  }
  if (data.phone && !/^[6-9]\d{9}$/.test(data.phone)) {
    errors.phone = 'Enter valid 10-digit Indian mobile';
  }
  return errors;
}

export function isProfileComplete(p: Profile | null): boolean {
  if (!p) return false;
  const name = (p.display_name || '').trim();
  const age = p.age ?? 0;
  const att = p.attempt ?? 0;
  return name.length >= 2 && age >= 16 && age <= 45 && att >= 1 && att <= 10;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperuser = useCallback(
    (email?: string | null) => {
      if (!email) return false;
      const lower = email.toLowerCase();
      return lower === 'sanit@upsc-nishant.me' || lower === 'sanit';
    },
    [],
  );

  // Effective features (merged with defaults, superuser override)
  const features: FeatureGates = isSuperuser(user?.email)
    ? SUPERUSER_FEATURES
    : { ...DEFAULT_FEATURES, ...(profile?.features_enabled || {}) };

  // Initials for avatar
  const initials = (profile?.display_name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // ── Fetch profile from DB ──────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Try localStorage first for instant render
    const cacheKey = `upsc_profile_${user.id}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Profile;
        setProfile(parsed);
      }
    } catch {
      /* ignore */
    }

    // Always verify against DB
    try {
      const { data, error } = await supabase
        .from('upsc_user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error || !data) {
        setProfile(null);
        localStorage.removeItem(cacheKey);
      } else {
        setProfile(data as Profile);
        localStorage.setItem(cacheKey, JSON.stringify(data));
      }
    } catch {
      /* keep cached profile if DB unreachable */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ── Save profile ───────────────────────────────────────────────────────────
  const saveProfile = useCallback(
    async (data: ProfileFormData) => {
      if (!user) throw new Error('Not authenticated');

      await supabase.from('upsc_user_profiles').upsert(
        {
          user_id: user.id,
          display_name: data.display_name,
          age: data.age,
          attempt: data.attempt,
          email: user.email,
          phone: data.phone || null,
          optional_subject: data.optional_subject || 'none',
          optional_subject_custom: data.optional_subject_custom || '',
        },
        { onConflict: 'user_id' },
      );

      // Update local cache
      const updated: Profile = {
        ...profile,
        user_id: user.id,
        display_name: data.display_name,
        age: data.age,
        attempt: data.attempt,
        phone: data.phone,
        optional_subject: data.optional_subject,
        optional_subject_custom: data.optional_subject_custom,
      };
      setProfile(updated);
      localStorage.setItem(`upsc_profile_${user.id}`, JSON.stringify(updated));
    },
    [user, profile],
  );

  return {
    profile,
    loading,
    features,
    initials,
    isSuperuser: isSuperuser(user?.email),
    saveProfile,
    refetch: fetchProfile,
    isComplete: isProfileComplete(profile),
    OPTIONAL_SUBJECTS,
  };
}
