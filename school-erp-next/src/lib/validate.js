/**
 * Lightweight, dependency-free validation helpers.
 * Keeps the same rules everywhere so every form behaves identically.
 */

export const isEmail = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
export const isPhone = (v) => !v || /^[0-9+\-\s()]{7,15}$/.test(v);
export const isRequired = (v) => v !== null && v !== undefined && String(v).trim() !== '';

/**
 * Run a rules object against a form object.
 * rules = { field: [ {test:(val,form)=>bool, msg:'...'} , ... ] }
 * Returns { field: 'first failing message' } — empty object means valid.
 */
export function runValidation(form, rules) {
  const errors = {};
  for (const field in rules) {
    for (const rule of rules[field]) {
      if (!rule.test(form[field], form)) {
        errors[field] = rule.msg;
        break;
      }
    }
  }
  return errors;
}

// Common ready-made rule builders
export const required = (msg = 'This field is required') => ({ test: isRequired, msg });
export const email = (msg = 'Enter a valid email address') => ({ test: isEmail, msg });
export const phone = (msg = 'Enter a valid phone number') => ({ test: isPhone, msg });
export const minLen = (n, msg) => ({
  test: (v) => !v || String(v).length >= n,
  msg: msg || `Must be at least ${n} characters`,
});
export const positive = (msg = 'Must be a positive number') => ({
  test: (v) => v === '' || v === null || v === undefined || Number(v) >= 0,
  msg,
});
