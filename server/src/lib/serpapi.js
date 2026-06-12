// Google Flights search via SerpApi.
// Set SERPAPI_KEY in your Render environment variables.
// Get your key at https://serpapi.com
//
// ⚠️  Never commit your API key to git. Use env vars only.

const BASE = 'https://serpapi.com/search.json';

// Format minutes → "2h 30m"
function formatDuration(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
}

// SerpApi returns times as "2024-06-15 08:30" — convert to ISO so new Date() is unambiguous.
function toIso(str) {
  if (!str) return str;
  // Already ISO-ish
  if (str.includes('T')) return str;
  // "YYYY-MM-DD HH:MM" → "YYYY-MM-DDTHH:MM:00"
  return str.replace(' ', 'T') + ':00';
}

// Normalise one SerpApi flight offer to the same shape Travel.jsx expects.
function normaliseOffer(offer, idx, currency) {
  const segs = offer.flights || [];
  if (!segs.length) return null;

  const itinerary = {
    departure: {
      iataCode: segs[0].departure_airport?.id || '',
      at: toIso(segs[0].departure_airport?.time),
    },
    arrival: {
      iataCode: segs[segs.length - 1].arrival_airport?.id || '',
      at: toIso(segs[segs.length - 1].arrival_airport?.time),
    },
    duration: formatDuration(offer.total_duration),
    stops: segs.length - 1,
    segments: segs.map((s) => {
      const parts = (s.flight_number || '').split(' ');
      return {
        from: s.departure_airport?.id || '',
        fromTime: toIso(s.departure_airport?.time),
        to: s.arrival_airport?.id || '',
        toTime: toIso(s.arrival_airport?.time),
        carrier: s.airline || '',
        carrierCode: parts[0] || '',
        flightNumber: s.flight_number || '',
        duration: formatDuration(s.duration),
      };
    }),
  };

  const firstSeg = segs[0];
  const carrierCode = (firstSeg.flight_number || '').split(' ')[0] || '';

  return {
    offerId: `serpapi-${idx}`,
    price: offer.price,
    currency,
    airline: firstSeg.airline || carrierCode,
    airlineCode: carrierCode,
    itineraries: [itinerary],
  };
}

// Normalise a round-trip offer (SerpApi groups outbound + return under one entry).
function normaliseRoundTrip(offer, idx, currency) {
  const norm = normaliseOffer(offer, idx, currency);
  if (!norm) return null;

  // SerpApi puts return_flights at offer.return_flights for round trips.
  if (offer.return_flights?.length) {
    const retSegs = offer.return_flights;
    const retItin = {
      departure: {
        iataCode: retSegs[0].departure_airport?.id || '',
        at: toIso(retSegs[0].departure_airport?.time),
      },
      arrival: {
        iataCode: retSegs[retSegs.length - 1].arrival_airport?.id || '',
        at: toIso(retSegs[retSegs.length - 1].arrival_airport?.time),
      },
      duration: formatDuration(retSegs.reduce((s, r) => s + (r.duration || 0), 0)),
      stops: retSegs.length - 1,
      segments: retSegs.map((s) => {
        const parts = (s.flight_number || '').split(' ');
        return {
          from: s.departure_airport?.id || '',
          fromTime: toIso(s.departure_airport?.time),
          to: s.arrival_airport?.id || '',
          toTime: toIso(s.arrival_airport?.time),
          carrier: s.airline || '',
          carrierCode: parts[0] || '',
          flightNumber: s.flight_number || '',
          duration: formatDuration(s.duration),
        };
      }),
    };
    norm.itineraries.push(retItin);
  }

  return norm;
}

// Main flight search. Returns normalised offer array (same shape as amadeus.js).
export async function searchFlights({ origin, destination, departureDate, returnDate, adults = 1, currency = 'USD' }) {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error('SERPAPI_KEY environment variable is not set');

  const isRoundTrip = !!returnDate;

  const params = new URLSearchParams({
    engine: 'google_flights',
    api_key: key,
    departure_id: origin.toUpperCase(),
    arrival_id: destination.toUpperCase(),
    outbound_date: departureDate,
    currency,
    hl: 'en',
    adults: String(adults),
    type: isRoundTrip ? '1' : '2',  // 1=round trip, 2=one way
  });

  if (isRoundTrip && returnDate) {
    params.set('return_date', returnDate);
  }

  const res = await fetch(`${BASE}?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.error || `SerpApi error ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  const raw = [...(data.best_flights || []), ...(data.other_flights || [])];

  return raw
    .map((offer, i) =>
      isRoundTrip ? normaliseRoundTrip(offer, i, currency) : normaliseOffer(offer, i, currency)
    )
    .filter(Boolean);
}

// Airport search is handled by the static airports list (airports.js).
// This export is a no-op stub kept for API compatibility.
export async function searchLocations(keyword) {
  // Resolved in travel.js via the local airports list.
  return [];
}
