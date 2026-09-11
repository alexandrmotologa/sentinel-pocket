import { useEffect, useState } from 'react';
import { Incident, LatencyTick, Service } from '../types.js';

interface UseSSEProps {
  onTick?: (tick: LatencyTick) => void;
  onServiceUpdated?: (service: Service) => void;
  onIncidentEvent?: (data: { type: 'CREATED' | 'UPDATED'; incident: Incident }) => void;
}

export function useSSE({ onTick, onServiceUpdated, onIncidentEvent }: UseSSEProps) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connect = () => {
      eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        setIsConnected(true);
      };

      eventSource.addEventListener('tick', (e: MessageEvent) => {
        try {
          const data: LatencyTick = JSON.parse(e.data);
          onTick?.(data);
        } catch {
          // ignore parse error
        }
      });

      eventSource.addEventListener('service', (e: MessageEvent) => {
        try {
          const data: Service = JSON.parse(e.data);
          onServiceUpdated?.(data);
        } catch {
          // ignore parse error
        }
      });

      eventSource.addEventListener('incident', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          onIncidentEvent?.(data);
        } catch {
          // ignore parse error
        }
      });

      eventSource.onerror = () => {
        setIsConnected(false);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, [onTick, onServiceUpdated, onIncidentEvent]);

  return { isConnected };
}
