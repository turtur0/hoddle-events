import { TicketmasterEvent } from '@/app/lib/types';

export const mockTicketmasterEvent: TicketmasterEvent = {
  id: 'TM001',
  name: 'Test Concert',
  description: 'An amazing test concert',
  info: 'An amazing test concert', // NEW: Added info field
  url: 'https://ticketmaster.com/test',
  dates: {
    start: {
      localDate: '2025-12-15',
      localTime: '19:00:00',
    },
  },
  classifications: [
    {
      segment: { name: 'Music' },
      genre: { name: 'Rock' },
      subGenre: { name: 'Hard Rock' }, // NEW: Added subGenre
    },
  ],
  priceRanges: [
    {
      min: 50,
      max: 150,
      currency: 'AUD',
    },
  ],
  images: [
    { url: 'https://example.com/image1.jpg', width: 1024, height: 768 },
    { url: 'https://example.com/image2.jpg', width: 512, height: 384 },
  ],
  _embedded: {
    venues: [
      {
        name: 'Test Arena',
        address: { line1: '123 Test St' },
        city: { name: 'Melbourne' },
        state: { name: 'Victoria' },
      },
    ],
  },
};

export const mockFreeEvent: TicketmasterEvent = {
  id: 'TM002',
  name: 'Free Festival',
  info: undefined, // NEW: Explicitly set optional field
  url: 'https://ticketmaster.com/free',
  dates: {
    start: {
      localDate: '2025-11-20',
    },
  },
  priceRanges: [
    {
      min: 0,
      max: 0,
      currency: 'AUD',
    },
  ],
  _embedded: {
    venues: [
      {
        name: 'Federation Square',
        city: { name: 'Melbourne' },
      },
    ],
  },
};

export const mockMinimalEvent: TicketmasterEvent = {
  id: 'TM003',
  name: 'Minimal Event',
  info: undefined, // NEW
  url: 'https://ticketmaster.com/minimal',
  dates: {
    start: {
      localDate: '2025-12-01',
    },
  },
};

export const mockMultiDayEvent: TicketmasterEvent = {
  id: 'TM004',
  name: 'Music Festival',
  info: undefined, // NEW
  url: 'https://ticketmaster.com/festival',
  dates: {
    start: {
      localDate: '2025-12-20',
      localTime: '10:00:00',
    },
    end: {
      localDate: '2025-12-22',
      localTime: '23:00:00',
    },
  },
  _embedded: {
    venues: [
      {
        name: 'Sidney Myer Music Bowl',
        address: { line1: 'King Domain' },
        city: { name: 'Melbourne' },
      },
    ],
  },
};

export const mockDuplicateEvents: TicketmasterEvent[] = [
  {
    id: 'TM005A',
    name: 'HAIR - THE MUSICAL',
    info: undefined, // NEW
    url: 'https://ticketmaster.com/hair1',
    dates: {
      start: {
        localDate: '2025-12-10',
        localTime: '19:30:00',
      },
    },
    _embedded: {
      venues: [
        {
          name: 'Comedy Theatre',
          city: { name: 'Melbourne' },
        },
      ],
    },
  },
  {
    id: 'TM005B',
    name: 'Hair - The Musical',
    info: undefined, // NEW
    url: 'https://ticketmaster.com/hair2',
    dates: {
      start: {
        localDate: '2025-12-11',
        localTime: '14:00:00',
      },
    },
    _embedded: {
      venues: [
        {
          name: 'Comedy Theatre',
          city: { name: 'Melbourne' },
        },
      ],
    },
  },
];

export const mockInvalidDateEvent: TicketmasterEvent = {
  id: 'TM006',
  name: 'Invalid Date Event',
  info: undefined, // NEW
  url: 'https://ticketmaster.com/invalid',
  dates: {
    start: {
      localDate: 'not-a-date',
    },
  },
};