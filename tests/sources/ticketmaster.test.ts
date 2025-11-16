// tests/sources/ticketmaster.test.ts
import { fetchTicketmasterEvents } from '@/app/lib/scrapers/ticketmaster';
import { mockApiResponse } from '../mocks/ticketmaster.mocks';

// Mock fetch globally
global.fetch = jest.fn();

describe('Ticketmaster API Integration', () => {
  const originalApiKey = process.env.TICKETMASTER_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore API key before each test
    process.env.TICKETMASTER_API_KEY = originalApiKey;
  });

  afterAll(() => {
    // Ensure API key is restored after all tests
    process.env.TICKETMASTER_API_KEY = originalApiKey;
  });

  it('should fetch events successfully', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockApiResponse,
    });

    const events = await fetchTicketmasterEvents(0, 2);

    expect(events).toHaveLength(2);
    expect(events[0].name).toBe('Taylor Swift | The Eras Tour');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Verify API call parameters (handle URL encoding)
    const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(callUrl).toContain('app.ticketmaster.com');
    // Check for encoded comma OR regular comma
    expect(
      callUrl.includes('latlong=-37.8136,144.9631') || 
      callUrl.includes('latlong=-37.8136%2C144.9631')
    ).toBe(true);
    expect(callUrl).toContain('radius=50');
  });

  it('should handle empty results', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ page: { totalElements: 0 } }),
    });

    const events = await fetchTicketmasterEvents();

    expect(events).toHaveLength(0);
  });

  it('should throw error when API key is missing', async () => {
    delete process.env.TICKETMASTER_API_KEY;

    await expect(fetchTicketmasterEvents()).rejects.toThrow(
      'TICKETMASTER_API_KEY not found'
    );

    // Fetch should not be called if API key is missing
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should throw error on failed API request', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    await expect(fetchTicketmasterEvents()).rejects.toThrow(
      'Ticketmaster API error: 401'
    );
  });

  it('should handle network errors', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network error')
    );

    await expect(fetchTicketmasterEvents()).rejects.toThrow('Network error');
  });
});