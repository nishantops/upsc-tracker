import { useState, type FormEvent } from 'react';
import {
  useProfile,
  validateProfile,
  type ProfileFormData,
  type ProfileErrors,
} from '../hooks/useProfile';

export function ProfileSetup() {
  const { saveProfile, profile } = useProfile();
  const [form, setForm] = useState<ProfileFormData>({
    display_name: profile?.display_name || '',
    age: profile?.age || ('' as unknown as number),
    attempt: profile?.attempt || ('' as unknown as number),
    phone: profile?.phone || '',
    optional_subject: profile?.optional_subject || 'none',
    optional_subject_custom: profile?.optional_subject_custom || '',
  });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);

  const isNew = !profile?.display_name;

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
      // Parent component will detect isComplete change and re-render
    } catch {
      setErrors({ name: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card" style={{ maxWidth: 440 }}>
        <div className="auth-header">
          <div className="auth-avatar">
            {(form.display_name || 'U')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .substring(0, 2)
              .toUpperCase()}
          </div>
          <h1 className="auth-title">
            {isNew ? 'Welcome! Set Up Your Profile' : 'Complete Your Profile'}
          </h1>
          <p className="auth-tagline">
            {isNew
              ? 'Just a few details to personalise your Command Center'
              : 'Please fill in the missing fields to unlock your Command Center'}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Name */}
          <div className="auth-field">
            <input
              className={`auth-input ${errors.name ? 'input-error' : ''}`}
              placeholder="Full Name"
              value={form.display_name}
              onChange={(e) => handleChange('display_name', e.target.value)}
              autoFocus
            />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>

          {/* Age */}
          <div className="auth-field">
            <input
              className={`auth-input ${errors.age ? 'input-error' : ''}`}
              type="number"
              placeholder="Age (16-45)"
              value={form.age || ''}
              onChange={(e) => handleChange('age', e.target.value)}
              min={16}
              max={45}
            />
            {errors.age && <p className="field-error">{errors.age}</p>}
          </div>

          {/* Attempt */}
          <div className="auth-field">
            <input
              className={`auth-input ${errors.attempt ? 'input-error' : ''}`}
              type="number"
              placeholder="Attempt number (1-10)"
              value={form.attempt || ''}
              onChange={(e) => handleChange('attempt', e.target.value)}
              min={1}
              max={10}
            />
            {errors.attempt && <p className="field-error">{errors.attempt}</p>}
          </div>

          {/* Phone */}
          <div className="auth-field">
            <input
              className={`auth-input ${errors.phone ? 'input-error' : ''}`}
              type="tel"
              placeholder="Phone (optional, 10 digits)"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
            />
            {errors.phone && <p className="field-error">{errors.phone}</p>}
          </div>

          {/* Optional Subject */}
          <div className="auth-field">
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

          <button type="submit" className="auth-btn auth-btn-primary" disabled={saving}>
            {saving ? '✨ Setting up…' : '🚀 Launch Command Center'}
          </button>
        </form>
      </div>
    </div>
  );
}
