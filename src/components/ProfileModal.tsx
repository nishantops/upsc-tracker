import { useState, useEffect, type FormEvent } from 'react';
import {
  useProfile,
  validateProfile,
  type ProfileFormData,
  type ProfileErrors,
} from '../hooks/useProfile';
import { useAuth } from '../context/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ProfileModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const { profile, saveProfile, initials } = useProfile();
  const [form, setForm] = useState<ProfileFormData>({
    display_name: '',
    age: 0,
    attempt: 0,
    phone: '',
    optional_subject: 'none',
    optional_subject_custom: '',
  });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);

  // Sync form with profile when modal opens
  useEffect(() => {
    if (open && profile) {
      setForm({
        display_name: profile.display_name || '',
        age: profile.age || ('' as unknown as number),
        attempt: profile.attempt || ('' as unknown as number),
        phone: profile.phone || '',
        optional_subject: profile.optional_subject || 'none',
        optional_subject_custom: profile.optional_subject_custom || '',
      });
      setErrors({});
    }
  }, [open, profile]);

  if (!open) return null;

  const handleChange = (field: keyof ProfileFormData, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field === 'display_name' ? 'name' : field]: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateProfile(form);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      await saveProfile(form);
      onClose();
    } catch {
      setErrors({ name: 'Failed to save. Try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-avatar">{initials}</div>
          <div>
            <h2 className="modal-title">Edit Profile</h2>
            <p className="modal-subtitle">{user?.email}</p>
            {profile?.created_at && (
              <p className="modal-subtitle">
                Member since{' '}
                {new Date(profile.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="field-label">Full Name</label>
            <input
              className={`auth-input ${errors.name ? 'input-error' : ''}`}
              value={form.display_name}
              onChange={(e) => handleChange('display_name', e.target.value)}
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          <div className="form-row">
            <div className="auth-field">
              <label className="field-label">Age</label>
              <input
                className={`auth-input ${errors.age ? 'input-error' : ''}`}
                type="number"
                value={form.age || ''}
                onChange={(e) => handleChange('age', e.target.value)}
                min={16}
                max={45}
              />
              {errors.age && <p className="field-error">{errors.age}</p>}
            </div>
            <div className="auth-field">
              <label className="field-label">Attempt</label>
              <input
                className={`auth-input ${errors.attempt ? 'input-error' : ''}`}
                type="number"
                value={form.attempt || ''}
                onChange={(e) => handleChange('attempt', e.target.value)}
                min={1}
                max={10}
              />
              {errors.attempt && <p className="field-error">{errors.attempt}</p>}
            </div>
          </div>

          <div className="auth-field">
            <label className="field-label">Phone (optional)</label>
            <input
              className={`auth-input ${errors.phone ? 'input-error' : ''}`}
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
            {errors.phone && <p className="field-error">{errors.phone}</p>}
          </div>

          <div className="auth-field">
            <label className="field-label">Optional Subject</label>
            <select
              className="auth-input"
              value={form.optional_subject}
              onChange={(e) => handleChange('optional_subject', e.target.value)}
            >
              <option value="none">No optional selected</option>
              <option value="Anthropology">Anthropology</option>
              <option value="Geography">Geography</option>
              <option value="Public Administration">Public Administration</option>
              <option value="Sociology">Sociology</option>
              <option value="History">History</option>
              <option value="Political Science & IR">Political Science & IR</option>
              <option value="Philosophy">Philosophy</option>
              <option value="Law">Law</option>
              <option value="custom">Other (type below)</option>
            </select>
          </div>

          {form.optional_subject === 'custom' && (
            <div className="auth-field">
              <input
                className="auth-input"
                placeholder="Your optional subject"
                value={form.optional_subject_custom}
                onChange={(e) => handleChange('optional_subject_custom', e.target.value)}
              />
            </div>
          )}

          <div className="auth-buttons">
            <button type="submit" className="auth-btn auth-btn-primary" disabled={saving}>
              {saving ? '✨ Saving…' : '💾 Save Profile'}
            </button>
            <button type="button" className="auth-btn auth-btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
