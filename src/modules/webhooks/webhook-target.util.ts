import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import * as ipaddr from 'ipaddr.js';

export type PinnedWebhookAgents = {
  httpAgent: HttpAgent;
  httpsAgent: HttpsAgent;
};

export async function resolvePublicWebhookUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Webhook URL is invalid.');
  }

  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'Webhook URL must use public HTTP or HTTPS without credentials.',
    );
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await dnsLookup(hostname, { all: true, verbatim: true });

  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new Error('Webhook URL must resolve only to public IP addresses.');
  }

  return { url, addresses };
}

export function createPinnedWebhookAgents(
  addresses: LookupAddress[],
): PinnedWebhookAgents {
  const lookup = ((
    _hostname: string,
    options: number | { family?: number; all?: boolean },
    callback: (...args: any[]) => void,
  ) => {
    const family = typeof options === 'number' ? options : options.family;
    const candidates = addresses.filter(
      (address) => !family || address.family === family,
    );
    const selected = candidates[0] ?? addresses[0];

    if (typeof options === 'object' && options.all) {
      callback(null, candidates.length ? candidates : addresses);
      return;
    }

    callback(null, selected.address, selected.family);
  }) as LookupFunction;

  return {
    httpAgent: new HttpAgent({ lookup, keepAlive: false }),
    httpsAgent: new HttpsAgent({ lookup, keepAlive: false }),
  };
}

function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}
