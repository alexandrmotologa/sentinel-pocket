import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';
import { ProbeResult } from '../types.js';

export class ProberEngine {
  public static async probe(target: string, timeoutMs = 5000): Promise<ProbeResult> {
    const timestamp = Date.now();

    // Check if target is a synthetic / mock internal mesh URL
    if (target.includes('.internal') || target.includes('.mesh') || target.startsWith('mock:')) {
      return this.generateSyntheticProbe(target, timestamp);
    }

    let parsedUrl: URL;
    try {
      const normalized = target.startsWith('http://') || target.startsWith('https://') ? target : `https://${target}`;
      parsedUrl = new URL(normalized);
    } catch {
      return {
        target,
        protocol: 'HTTP',
        dnsLookupMs: 0,
        ttfbMs: 0,
        totalTimeMs: 0,
        isReachable: false,
        statusMessage: 'Invalid URL format',
        timestamp,
      };
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    return new Promise<ProbeResult>((resolve) => {
      const startTime = performance.now();
      let dnsTime = 0;
      let ttfbTime = 0;

      const req = client.request(
        parsedUrl,
        {
          method: 'HEAD',
          timeout: timeoutMs,
          headers: { 'User-Agent': 'SentinelPocket-Probe/1.0' },
        },
        (res) => {
          ttfbTime = Math.round(performance.now() - startTime);

          let sslInfo: ProbeResult['ssl'];
          if (isHttps) {
            const cert = (res.socket as any).getPeerCertificate?.();
            if (cert && cert.valid_to) {
              const validTo = new Date(cert.valid_to);
              const daysRemaining = Math.max(0, Math.floor((validTo.getTime() - Date.now()) / (1000 * 86400)));
              sslInfo = {
                valid: daysRemaining > 0,
                issuer: typeof cert.issuer === 'object' ? cert.issuer.O || cert.issuer.CN : String(cert.issuer),
                validTo: validTo.toISOString().split('T')[0],
                daysRemaining,
                tlsVersion: (res.socket as any).getProtocol?.() || 'TLSv1.3',
              };
            }
          }

          // Consume response
          res.resume();
          res.on('end', () => {
            const totalTime = Math.round(performance.now() - startTime);
            resolve({
              target: parsedUrl.href,
              protocol: isHttps ? 'HTTPS' : 'HTTP',
              statusCode: res.statusCode,
              statusMessage: res.statusMessage,
              dnsLookupMs: Math.max(1, Math.round(dnsTime)),
              ttfbMs: Math.max(1, ttfbTime),
              totalTimeMs: Math.max(1, totalTime),
              ssl: sslInfo,
              headers: {
                server: String(res.headers.server || 'Generic'),
                'content-type': String(res.headers['content-type'] || 'text/plain'),
              },
              isReachable: true,
              timestamp,
            });
          });
        }
      );

      req.on('socket', (socket) => {
        socket.on('lookup', () => {
          dnsTime = performance.now() - startTime;
        });
      });

      req.on('error', (err) => {
        resolve({
          target: parsedUrl.href,
          protocol: isHttps ? 'HTTPS' : 'HTTP',
          statusMessage: err.message,
          dnsLookupMs: Math.round(dnsTime),
          ttfbMs: 0,
          totalTimeMs: Math.round(performance.now() - startTime),
          isReachable: false,
          timestamp,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          target: parsedUrl.href,
          protocol: isHttps ? 'HTTPS' : 'HTTP',
          statusMessage: 'Connection timed out',
          dnsLookupMs: Math.round(dnsTime),
          ttfbMs: 0,
          totalTimeMs: timeoutMs,
          isReachable: false,
          timestamp,
        });
      });

      req.end();
    });
  }

  private static generateSyntheticProbe(target: string, timestamp: number): ProbeResult {
    const isPayments = target.includes('payments');
    const isAuth = target.includes('auth');
    const latency = isPayments ? 420 : isAuth ? 48 : 12;

    return {
      target,
      protocol: target.startsWith('tcp') ? 'TCP' : 'HTTPS',
      statusCode: isPayments ? 504 : 200,
      statusMessage: isPayments ? 'Gateway Timeout' : 'OK',
      dnsLookupMs: 4,
      ttfbMs: latency,
      totalTimeMs: latency + 8,
      ssl: {
        valid: true,
        issuer: "Let's Encrypt Authority X3",
        validTo: '2026-11-28',
        daysRemaining: 78,
        tlsVersion: 'TLSv1.3 (ChaCha20-Poly1305)',
      },
      headers: {
        server: 'envoy/1.28.0 (CanaryMesh)',
        'x-envoy-upstream-service-time': `${latency}`,
      },
      isReachable: true,
      timestamp,
    };
  }
}
