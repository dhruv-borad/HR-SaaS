// Amadeus Travel API client.
// Set AMADEUS_API_KEY and AMADEUS_API_SECRET in your environment.
// Use AMADEUS_ENV=production for live data (default: test).
// Get free credentials at https://developers.amadeus.com

const BASE = process.env.AMADEUS_ENV === 'production'
  ? 'https://api.amadeus.com'
  : 'https://test.api.amadeus.com';

let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await fetch(`${BASE}/v1/security/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.AMADEUS_API_KEY,
      client_secret: process.env.AMADEUS_API_SECRET,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Amadeus auth failed: ${t}`);
  }
  const data = await res.json();
  _token = data.access_token;
  _tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _token;
}

// Search airports/cities by keyword. Returns [{iataCode, name, cityName, countryCode}]
export async function searchLocations(keyword) {
  const token = await getToken();
  const params = new URLSearchParams({ keyword, subType: 'CITY,AIRPORT', page: { limit: 8 } });
  const res = await fetch(`${BASE}/v1/reference-data/locations?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Location search failed: ${res.status}`);
  const data = await res.json();
  return (data.data || []).map((l) => ({
    iataCode: l.iataCode,
    name: l.name,
    cityName: l.address?.cityName || l.name,
    countryCode: l.address?.countryCode,
  }));
}

// Parse ISO duration "PT2H30M" → "2h 30m"
function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return iso;
  const h = m[1] ? `${m[1]}h ` : '';
  const min = m[2] ? `${m[2]}m` : '';
  return (h + min).trim();
}

// Normalise a raw Amadeus flight offer into a UI-friendly shape.
function normaliseOffer(offer, carriers) {
  const itineraries = offer.itineraries.map((itin) => {
    const segs = itin.segments;
    const first = segs[0];
    const last = segs[segs.length - 1];
    return {
      departure: { iataCode: first.departure.iataCode, at: first.departure.at },
      arrival: { iataCode: last.arrival.iataCode, at: last.arrival.at },
      duration: parseDuration(itin.duration),
      stops: segs.length - 1,
      segments: segs.map((s) => ({
        from: s.departure.iataCode,
        fromTime: s.departure.at,
        to: s.arrival.iataCode,
        toTime: s.arrival.at,
        carrier: carriers[s.carrierCode] || s.carrierCode,
        carrierCode: s.carrierCode,
        flightNumber: `${s.carrierCode}${s.number}`,
        duration: parseDuration(s.duration),
      })),
    };
  });

  const mainCarrierCode = offer.validatingAirlineCodes?.[0] || offer.itineraries[0].segments[0].carrierCode;

  return {
    offerId: offer.id,
    price: parseFloat(offer.price.total),
    currency: offer.price.currency,
    airline: carriers[mainCarrierCode] || mainCarrierCode,
    airlineCode: mainCarrierCode,
    itineraries,
    raw: offer, // keep full offer in case we need it later
  };
}

// Search flights. Returns normalised offer array.
export async function searchFlights({ origin, destination, departureDate, returnDate, adults = 1, currency = 'USD' }) {
  const token = await getToken();
  const params = new URLSearchParams({
    originLocationCode: origin.toUpperCase(),
    destinationLocationCode: destination.toUpperCase(),
    departureDate,
    adults: String(adults),
    currencyCode: currency,
    max: '12',
    nonStop: 'false',
  });
  if (returnDate) params.set('returnDate', returnDate);

  const res = await fetch(`${BASE}/v2/shopping/flight-offers?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body.errors?.[0]?.detail || body.errors?.[0]?.title || `Amadeus API error ${res.status}`;
    throw new Error(msg);
  }

  const data = await res.json();
  const carriers = data.dictionaries?.carriers || {};
  return (data.data || []).map((o) => normaliseOffer(o, carriers));
}
