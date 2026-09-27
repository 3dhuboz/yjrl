import { useEffect, useState } from 'react';
import api from './api';

let request, expires = 0;
export default function useMapsConfig(enabled = true) {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    if (!request || Date.now() > expires) {
      expires = Date.now() + 60000;
      request = api.get('/yjrl/maps/config').then(res => res.data).catch(() => ({ searchAvailable: false, embedKey: '' }));
    }
    request.then(value => { if (active) setConfig(value); });
    return () => { active = false; };
  }, [enabled]);
  return config;
}
