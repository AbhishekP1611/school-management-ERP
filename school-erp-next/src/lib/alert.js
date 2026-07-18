import Swal from 'sweetalert2';

// Helper to get current logged in user from localStorage
const getCurrentUser = () => {
  try {
    if (typeof window === 'undefined') return {};
    return JSON.parse(localStorage.getItem('user')) || {};
  } catch {
    return {};
  }
};

// Guess the action verb from the success title so the badge line reads correctly
// (e.g. "Student added" → "Added by", "Fee record deleted" → "Deleted by").
const actionFromTitle = (title = '') => {
  const t = title.toLowerCase();
  if (t.includes('login') || t.includes('logged in') || t.includes('sign in')) return 'Logged in by';
  if (t.includes('logout') || t.includes('logged out')) return 'Logged out by';
  if (t.includes('delet') || t.includes('removed')) return 'Deleted by';
  if (t.includes('add') || t.includes('creat') || t.includes('collect')) return 'Saved by';
  if (t.includes('sav')) return 'Saved by';
  if (t.includes('updat')) return 'Updated by';
  return 'Actioned by';
};

// ✅ Success popup — auto closes in 2s, shows who did it & which action
// Pass an explicit `actionLabel` to override the auto-detected verb.
export const showSuccess = (title, actionLabel) => {
  const { username } = getCurrentUser();
  const label = actionLabel || actionFromTitle(title);
  return Swal.fire({
    icon: 'success',
    title: `<span style="font-size:18px;font-weight:700;color:var(--text-primary)">${title}</span>`,
    html: username
      ? `<div style="margin-top:8px;font-size:13px;color:var(--text-muted)">
           ${label} &nbsp;
           <span style="font-weight:600;color:var(--text-primary)">${username}</span>
         </div>`
      : '',
    timer: 2000,
    timerProgressBar: true,
    showConfirmButton: false,
    customClass: {
      popup: 'swal-custom-popup',
    },
  });
};

// ❌ Error popup — auto closes in 2.5s
export const showError = (title) => {
  return Swal.fire({
    icon: 'error',
    title: `<span style="font-size:17px;font-weight:700;color:var(--text-primary)">Error</span>`,
    html: `<div style="font-size:14px;color:#ef4444">${title}</div>`,
    timer: 2500,
    timerProgressBar: true,
    showConfirmButton: false,
    customClass: {
      popup: 'swal-custom-popup',
    },
  });
};

// 💾 Save confirmation — required before every save
export const confirmSave = async (title = 'Save Changes?', text = 'Do you want to save these changes?') => {
  const { username } = getCurrentUser();
  const result = await Swal.fire({
    icon: 'question',
    title: `<span style="font-size:17px;font-weight:700;color:var(--text-primary)">${title}</span>`,
    html: `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:10px">${text}</div>
      ${username ? `
      <div style="font-size:12px;color:var(--text-muted);border-top:1px solid var(--border-col);padding-top:10px;margin-top:5px">
        Saving as &nbsp;<strong style="color:var(--text-primary)">${username}</strong>
      </div>` : ''}
    `,
    showCancelButton: true,
    confirmButtonText: '✅ Yes, Save',
    cancelButtonText: '✖ Cancel',
    confirmButtonColor: '#6c63ff',
    cancelButtonColor: '#ef4444',
    reverseButtons: false,
    customClass: {
      popup: 'swal-custom-popup',
      confirmButton: 'swal-confirm-btn',
      cancelButton: 'swal-cancel-btn',
    },
  });
  return result.isConfirmed;
};

// 🗑️ Delete confirmation
export const confirmAction = async (
  title = 'Are you sure?',
  text = "You won't be able to revert this!",
  confirmText = '🗑️ Yes, Delete',
  confirmColor = '#ef4444',
) => {
  const result = await Swal.fire({
    icon: 'warning',
    title: `<span style="font-size:17px;font-weight:700;color:var(--text-primary)">${title}</span>`,
    html: `<div style="font-size:13px;color:var(--text-muted)">${text}</div>`,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    confirmButtonColor: confirmColor,
    customClass: {
      popup: 'swal-custom-popup',
    },
  });
  return result.isConfirmed;
};

// 🚪 Logout confirmation — shows which user is signing out
export const confirmLogout = async () => {
  const { username } = getCurrentUser();
  const result = await Swal.fire({
    icon: 'question',
    title: `<span style="font-size:17px;font-weight:700;color:var(--text-primary)">Logout?</span>`,
    html: `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:10px">Are you sure you want to sign out?</div>
      ${username ? `
      <div style="font-size:12px;color:var(--text-muted);border-top:1px solid var(--border-col);padding-top:10px;margin-top:5px">
        Signing out as &nbsp;<strong style="color:var(--text-primary)">${username}</strong>
      </div>` : ''}
    `,
    showCancelButton: true,
    confirmButtonText: '🚪 Yes, Logout',
    cancelButtonText: '✖ Cancel',
    confirmButtonColor: '#ef4444',
    customClass: {
      popup: 'swal-custom-popup',
      confirmButton: 'swal-confirm-btn',
      cancelButton: 'swal-cancel-btn',
    },
  });
  return result.isConfirmed;
};
