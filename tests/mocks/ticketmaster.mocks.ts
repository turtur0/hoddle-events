// tests/mocks/ticketmaster.mock.ts
import { TicketmasterEvent } from '../../src/app/lib/types';

export const mockTicketmasterEvent: TicketmasterEvent = {
  id: 'vv17G9Z9MaNYD4P',
  name: 'Taylor Swift | The Eras Tour',
  description: 'An epic journey through Taylor Swift\'s musical eras',
  url: 'https://www.ticketmaster.com.au/event/123456',
  dates: {
    start: {
      localDate: '2025-12-15',
      localTime: '19:30:00',
    },
  },
  classifications: [
    {
      segment: { name: 'Music' },
      genre: { name: 'Pop' },
    },
  ],
  priceRanges: [
    {
      min: 89.5,
      max: 299.99,
      currency: 'AUD',
    },
  ],
  images: [
    {
      url: 'https://s1.ticketm.net/dam/a/123/image.jpg',
      width: 1024,
      height: 768,
    },
    {
      url: 'https://s1.ticketm.net/dam/a/123/thumb.jpg',
      width: 205,
      height: 115,
    },
  ],
  _embedded: {
    venues: [
      {
        name: 'Marvel Stadium',
        address: { line1: 'Olympic Boulevard' },
        city: { name: 'Melbourne' },
        state: { name: 'Victoria' },
      },
    ],
  },
};

export const mockFreeEvent: TicketmasterEvent = {
  id: 'free123',
  name: 'Free Community Concert',
  url: 'https://www.ticketmaster.com.au/event/free123',
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
};

export const mockMinimalEvent: TicketmasterEvent = {
  id: 'minimal123',
  name: 'Mystery Event',
  url: 'https://www.ticketmaster.com.au/event/minimal123',
  dates: {
    start: {
      localDate: '2025-11-25',
    },
  },
};

export const mockApiResponse = {
  _embedded: {
    events: [mockTicketmasterEvent, mockFreeEvent],
  },
  page: {
    size: 2,
    totalElements: 2,
    totalPages: 1,
    number: 0,
  },
};