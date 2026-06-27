import { useState, useCallback } from 'react';

/* ─── Validation rules ────────────────────────────────────────── */
export const rules = {
  required: (label) => (v) =>
    !v || (typeof v === 'string' && !v.trim())
      ? `${label} is required`
      : null,

  email: (label = 'Email') => (v) =>
    v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      ? `${label} is not a valid email address`
      : null,

  phone: (label = 'Phone') => (v) =>
    v && !/^0[0-9]{9}$/.test(v.replace(/\s/g, ''))
      ? `${label} must be a valid Ghanaian number (e.g. 0244123456)`
      : null,

  minLength: (min, label) => (v) =>
    v && v.length < min
      ? `${label} must be at least ${min} characters`
      : null,

  hasNumber: (label) => (v) =>
    v && !/\d/.test(v)
      ? `${label} must contain at least one number`
      : null,

  min: (min, label) => (v) =>
    v !== '' && v !== null && v !== undefined && parseFloat(v) < min
      ? `${label} must be at least ${min}`
      : null,

  ghanaCard: () => (v) =>
    v && !/^GHA-\d{9}-\d$/.test(v)
      ? 'Ghana Card must be in format GHA-000000000-0'
      : null,

  date: (label) => (v) =>
    v && isNaN(new Date(v).getTime())
      ? `${label} must be a valid date`
      : null,

  futureDate: (label) => (v) =>
    v && new Date(v) < new Date()
      ? `${label} must be a future date`
      : null,
};

/* ─── Combine multiple rules for one field ───────────────────── */
export const validate = (value, ...validators) => {
  for (const validator of validators) {
    const error = validator(value);
    if (error) return error;
  }
  return null;
};

/* ─── Hook ───────────────────────────────────────────────────── */
export const useFormValidation = (schema) => {
  // schema: { fieldName: [rule1, rule2, ...] }
  const [errors, setErrors] = useState({});

  /* Run all rules for one field */
  const validateField = useCallback((name, value) => {
    const fieldRules = schema[name];
    if (!fieldRules) return null;
    for (const rule of fieldRules) {
      const error = rule(value);
      if (error) return error;
    }
    return null;
  }, [schema]);

  /* Clear one field's error as user types */
  const clearError = useCallback((name) => {
    setErrors(prev => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  /* Run all fields and return true if valid */
  const validateAll = useCallback((formValues) => {
    const newErrors = {};
    for (const [name, fieldRules] of Object.entries(schema)) {
      for (const rule of fieldRules) {
        const error = rule(formValues[name]);
        if (error) { newErrors[name] = error; break; }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [schema]);

  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, validateField, validateAll, clearError, clearAll, setErrors };
};

/* ─── FormError component ────────────────────────────────────── */
export const FormError = ({ error }) => {
  if (!error) return null;
  return (
    <p style={{
      color: '#ef4444',
      fontSize: '12px',
      margin: '4px 0 0',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
    }}>
      ⚠ {error}
    </p>
  );
};

/* ─── Styled input wrapper — adds red border on error ────────── */
export const inputStyle = (error) => ({
  borderColor: error ? '#ef4444' : undefined,
  boxShadow:   error ? '0 0 0 3px rgba(239,68,68,0.1)' : undefined,
});
