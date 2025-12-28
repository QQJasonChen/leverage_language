// Security utilities for safe DOM manipulation and input validation
class SecurityUtils {
  // Replace innerHTML with safe alternatives
  static setTextContent(element, text) {
    if (!element) return;
    element.textContent = text;
  }

  static setInnerHTML(element, html) {
    if (!element) return;
    
    // Basic HTML sanitization
    const sanitized = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
    
    element.innerHTML = sanitized;
  }

  // Input validation
  static validateSearchText(text) {
    if (!text || typeof text !== 'string') return false;
    if (text.length > 1000) return false; // Prevent abuse
    if (text.trim().length === 0) return false;
    return true;
  }

  static validateLanguage(language) {
    const validLanguages = ['english', 'japanese', 'korean', 'dutch'];
    return validLanguages.includes(language);
  }

  // API key encryption (simple XOR - replace with proper encryption in production)
  static encryptApiKey(key) {
    const secret = 'YouGlishExtension2024';
    let encrypted = '';
    for (let i = 0; i < key.length; i++) {
      encrypted += String.fromCharCode(key.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
    }
    return btoa(encrypted);
  }

  static decryptApiKey(encryptedKey) {
    try {
      const encrypted = atob(encryptedKey);
      const secret = 'YouGlishExtension2024';
      let decrypted = '';
      for (let i = 0; i < encrypted.length; i++) {
        decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
      }
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt API key:', error);
      return null;
    }
  }

  // Safe storage operations
  static async safeStorageSet(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      return { success: true };
    } catch (error) {
      if (error.message.includes('QUOTA_BYTES_PER_ITEM')) {
        return { success: false, error: 'Storage quota exceeded', code: 'QUOTA_EXCEEDED' };
      }
      return { success: false, error: error.message, code: 'STORAGE_ERROR' };
    }
  }

  static async safeStorageGet(key, defaultValue = null) {
    try {
      const result = await chrome.storage.local.get([key]);
      return { success: true, data: result[key] || defaultValue };
    } catch (error) {
      return { success: false, error: error.message, data: defaultValue };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SecurityUtils;
}