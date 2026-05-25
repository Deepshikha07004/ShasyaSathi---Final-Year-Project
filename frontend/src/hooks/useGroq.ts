import { useState } from 'react';
import { getGroqResponse } from './groq-expo';

export const useGroq = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);

  const ask = async (prompt: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getGroqResponse(prompt);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { ask, loading, error };
};
