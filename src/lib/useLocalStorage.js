import { useEffect, useState } from 'react';

// useState that mirrors its value to localStorage. Storage can be blocked
// (private mode, quota), so every access is wrapped and the app keeps working in memory.
export default function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? initialValue : JSON.parse(raw);
    } catch (err) {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      // Ignore: the value still lives in memory for this session.
    }
  }, [key, value]);

  return [value, setValue];
}
