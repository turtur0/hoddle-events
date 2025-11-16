import { connectDB, disconnectDB } from '../../src/app/lib/db';
import Event from '../../src/app/lib/models/Event';

describe('Database Connection Integration Tests', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  afterEach(async () => {
    // Clean up test events
    await Event.deleteMany({ sourceId: /^test-/ });
  });

  it('should connect to MongoDB Atlas', async () => {
    const connection = await connectDB();
    expect(connection.connection.readyState).toBe(1); // 1 = connected
  });

  it('should create and retrieve an event', async () => {
    const testEvent = await Event.create({
      title: 'Test Concert',
      description: 'A test event',
      category: 'Music',
      startDate: new Date('2025-12-01'),
      venue: {
        name: 'Test Venue',
        address: '123 Test St',
        suburb: 'Melbourne',
      },
      isFree: true,
      bookingUrl: 'https://example.com',
      source: 'ticketmaster',
      sourceId: 'test-123',
    });

    expect(testEvent._id).toBeDefined();
    expect(testEvent.title).toBe('Test Concert');

    const foundEvent = await Event.findById(testEvent._id);
    expect(foundEvent?.title).toBe('Test Concert');
  });

  it('should enforce unique source+sourceId constraint', async () => {
    const eventData = {
      title: 'Duplicate Test',
      description: 'Testing duplicates',
      category: 'Music',
      startDate: new Date('2025-12-01'),
      venue: {
        name: 'Test Venue',
        address: '123 Test St',
        suburb: 'Melbourne',
      },
      isFree: false,
      bookingUrl: 'https://example.com',
      source: 'ticketmaster' as const,
      sourceId: 'test-duplicate-123',
    };

    await Event.create(eventData);
    
    // Try to create duplicate - should fail
    await expect(Event.create(eventData)).rejects.toThrow();
  });
});