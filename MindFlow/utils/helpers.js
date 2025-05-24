// Common utility functions

/**
 * Normalizes an email address for consistent comparison
 * - Converts to lowercase
 * - Trims whitespace
 * - For Gmail addresses, removes dots from local part and removes +aliases
 * 
 * @param {string} email - The email address to normalize
 * @returns {string} - The normalized email address
 */
export const normalizeEmail = (email) => {
  if (!email) return '';
  
  email = email.toLowerCase().trim();
  
  // Special handling for Gmail addresses
  if (email.includes('@gmail.com')) {
    const [localPart, domain] = email.split('@');
    
    // Remove dots from local part (they're ignored by Gmail)
    let normalizedLocal = localPart.replace(/\./g, '');
    
    // Remove plus alias if present
    if (normalizedLocal.includes('+')) {
      normalizedLocal = normalizedLocal.split('+')[0];
    }
    
    return `${normalizedLocal}@${domain}`;
  }
  
  return email;
};

/**
 * Check if two emails are functionally equivalent
 * 
 * @param {string} email1 - First email to compare 
 * @param {string} email2 - Second email to compare
 * @returns {boolean} - True if emails are equivalent
 */
export const emailsAreEquivalent = (email1, email2) => {
  return normalizeEmail(email1) === normalizeEmail(email2);
};

/**
 * Formats a timestamp into a human-readable string
 * 
 * @param {Date|string|number} date - Date object or timestamp to format
 * @param {boolean} includeTime - Whether to include the time
 * @returns {string} - Formatted date string
 */
export const formatDateTime = (date, includeTime = true) => {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'object' ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' })
  };
  
  return dateObj.toLocaleDateString(undefined, options);
};

/**
 * Get a relative time string (e.g., "2 hours ago", "Just now")
 * 
 * @param {Date|string|number} date - Date object or timestamp
 * @returns {string} - Human-readable relative time
 */
export const getRelativeTimeString = (date) => {
  if (!date) return 'Never';
  
  const dateObj = typeof date === 'object' ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) return 'Invalid date';
  
  const now = new Date();
  const diffMs = now - dateObj;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 30) return 'Just now';
  if (diffMins < 1) return `${diffSecs} seconds ago`;
  if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
  if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  
  // If older than a month, return formatted date
  return formatDateTime(date);
}; 