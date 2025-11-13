import { useState, useEffect } from 'react';

interface ApiKeys {
  adminApiKey: string;
  submitApiKey: string;
}

const STORAGE_KEY = 'runpack_api_keys';

export function useApiKeys() {
  const [apiKeys, setApiKeys] = useState<ApiKeys>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return { adminApiKey: '', submitApiKey: '' };
      }
    }
    return { adminApiKey: '', submitApiKey: '' };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apiKeys));
  }, [apiKeys]);

  const updateApiKeys = (keys: Partial<ApiKeys>) => {
    setApiKeys(prev => ({ ...prev, ...keys }));
  };

  const clearApiKeys = () => {
    setApiKeys({ adminApiKey: '', submitApiKey: '' });
  };

  const hasAdminKey = () => apiKeys.adminApiKey.trim() !== '';
  const hasSubmitKey = () => apiKeys.submitApiKey.trim() !== '';

  return {
    apiKeys,
    updateApiKeys,
    clearApiKeys,
    hasAdminKey,
    hasSubmitKey,
  };
}
