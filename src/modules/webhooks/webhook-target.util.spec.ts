import {
  createPinnedWebhookAgents,
  resolvePublicWebhookUrl,
} from './webhook-target.util';

describe('webhook destination validation', () => {
  it.each([
    'http://127.0.0.1/hook',
    'http://[::1]/hook',
    'http://10.0.0.1/hook',
  ])('rejects private destination %s', async (url) => {
    await expect(resolvePublicWebhookUrl(url)).rejects.toThrow(
      'public IP addresses',
    );
  });

  it('creates pinned agents for a public literal address', async () => {
    const target = await resolvePublicWebhookUrl('https://8.8.8.8/hook');
    const agents = createPinnedWebhookAgents(target.addresses);

    expect(target.url.hostname).toBe('8.8.8.8');
    expect(agents.httpAgent).toBeDefined();
    expect(agents.httpsAgent).toBeDefined();

    agents.httpAgent.destroy();
    agents.httpsAgent.destroy();
  });
});
