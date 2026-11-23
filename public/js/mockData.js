export const mockEvents = [
  {
    id: 'lagos-jazz-night',
    organizerId: 'organizer-1',
    title: 'Lagos Jazz Night',
    city: 'Lagos',
    venue: 'Civic Hall',
    startsAt: '2027-05-10T18:00:00Z',
    status: 'published',
    tiers: [
      { id: 'lagos-general', eventId: 'lagos-jazz-night', name: 'General', priceCents: 125000, capacity: 100, sold: 28, seatsLeft: 72 },
      { id: 'lagos-vip', eventId: 'lagos-jazz-night', name: 'VIP', priceCents: 250000, capacity: 40, sold: 40, seatsLeft: 0 },
    ],
  },
  {
    id: 'abuja-tech-meetup',
    organizerId: 'organizer-2',
    title: 'Abuja Tech Meetup',
    city: 'Abuja',
    venue: 'Innovation Hub',
    startsAt: '2027-06-18T16:00:00Z',
    status: 'published',
    tiers: [
      { id: 'abuja-standard', eventId: 'abuja-tech-meetup', name: 'Standard', priceCents: 75000, capacity: 120, sold: 45, seatsLeft: 75 },
      { id: 'abuja-student', eventId: 'abuja-tech-meetup', name: 'Student', priceCents: 30000, capacity: 50, sold: 10, seatsLeft: 40 },
    ],
  },
  {
    id: 'port-harcourt-comedy',
    organizerId: 'organizer-3',
    title: 'Port Harcourt Comedy Live',
    city: 'Port Harcourt',
    venue: 'Rivers Theatre',
    startsAt: '2027-07-03T20:00:00Z',
    status: 'published',
    tiers: [
      { id: 'ph-regular', eventId: 'port-harcourt-comedy', name: 'Regular', priceCents: 50000, capacity: 80, sold: 80, seatsLeft: 0 },
    ],
  },
  {
    id: 'ibadan-food-fair',
    organizerId: 'organizer-4',
    title: 'Ibadan Food Fair',
    city: 'Ibadan',
    venue: 'Cultural Centre Mokola',
    startsAt: '2027-08-19T10:00:00Z',
    status: 'published',
    tiers: [
      { id: 'ibadan-general', eventId: 'ibadan-food-fair', name: 'General', priceCents: 250000, capacity: 400, sold: 20, seatsLeft: 380 },
    ],
  },
  {
    id: 'abuja-jazz-night',
    organizerId: 'organizer-5',
    title: 'Abuja Jazz Night',
    city: 'Abuja',
    venue: 'Transcorp Hilton',
    startsAt: '2027-09-12T19:00:00Z',
    status: 'published',
    tiers: [
      { id: 'abuja-jazz-general', eventId: 'abuja-jazz-night', name: 'General', priceCents: 800000, capacity: 100, sold: 33, seatsLeft: 67 },
    ],
  },
];

export default mockEvents;
