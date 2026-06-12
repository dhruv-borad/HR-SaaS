import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Table, Badge, Empty, Field, inputCls, btnPrimary, btnGhost, ErrorMsg, fmtDate, fmtMoney } from '../lib/ui.jsx';

// ──────────────────────────────────────────────
// Airport autocomplete input
// ──────────────────────────────────────────────
function AirportInput({ value, onChange, placeholder }) {
  const [query, setQuery] = useState(value?.label || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const box = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback((q) => {
    clearTimeout(timer.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api(`/api/travel/airports?q=${encodeURIComponent(q)}`);
        setResults(data);
        setOpen(true);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 300);
  }, []);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    // Clear selected value if user types
    if (value) onChange(null);
    search(q);
  };

  const handleSelect = (loc) => {
    setQuery(`${loc.cityName} (${loc.iataCode})`);
    onChange(loc);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={box} className="relative">
      <input
        className={inputCls}
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        autoComplete="off"
      />
      {loading && <span className="absolute right-3 top-2 text-gray-400 text-xs">…</span>}
      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-52 overflow-auto">
          {results.map((loc) => (
            <li
              key={loc.iataCode}
              className="px-3 py-2 hover:bg-indigo-50 cursor-pointer flex items-center gap-2"
              onMouseDown={() => handleSelect(loc)}
            >
              <span className="font-mono font-bold text-indigo-700 text-sm w-10">{loc.iataCode}</span>
              <span className="text-sm text-gray-800">{loc.cityName}</span>
              <span className="text-xs text-gray-400 ml-auto">{loc.countryCode}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// Flight card
// ──────────────────────────────────────────────
function FlightCard({ flight, budget, currency, onSelect }) {
  const overBudget = budget != null && flight.price > budget;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg p-4 ${overBudget ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-4">
        {/* Airline */}
        <div className="w-28 shrink-0">
          <div className="text-sm font-semibold text-gray-800">{flight.airline}</div>
          <div className="text-xs text-gray-400">{flight.airlineCode}</div>
        </div>

        {/* Outbound itinerary summary */}
        {flight.itineraries.map((itin, i) => (
          <div key={i} className="flex items-center gap-3 flex-1">
            <div className="text-center">
              <div className="font-bold text-gray-900 text-lg">{new Date(itin.departure.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="text-xs text-gray-500">{itin.departure.iataCode}</div>
            </div>
            <div className="flex-1 text-center">
              <div className="text-xs text-gray-400">{itin.duration}</div>
              <div className="border-t border-gray-300 relative my-1">
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-xs bg-white px-1 text-gray-400">
                  {itin.stops === 0 ? 'Direct' : `${itin.stops} stop${itin.stops > 1 ? 's' : ''}`}
                </span>
              </div>
              {i === 0 && flight.itineraries.length > 1 && (
                <div className="text-xs text-indigo-600 font-medium">Outbound</div>
              )}
              {i === 1 && (
                <div className="text-xs text-indigo-600 font-medium">Return</div>
              )}
            </div>
            <div className="text-center">
              <div className="font-bold text-gray-900 text-lg">{new Date(itin.arrival.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
              <div className="text-xs text-gray-500">{itin.arrival.iataCode}</div>
            </div>
          </div>
        ))}

        {/* Price + select */}
        <div className="text-right shrink-0">
          <div className={`text-xl font-bold ${overBudget ? 'text-red-600' : 'text-gray-900'}`}>
            {fmtMoney(flight.price, currency)}
          </div>
          {overBudget && (
            <div className="text-xs text-red-500">Over budget ({fmtMoney(budget, currency)})</div>
          )}
          {!overBudget && budget != null && (
            <div className="text-xs text-green-600">Within budget</div>
          )}
          <div className="flex gap-2 mt-2 justify-end">
            <button
              className="text-xs text-indigo-600 hover:underline"
              onClick={() => setExpanded((e) => !e)}
            >
              {expanded ? 'Hide details' : 'Details'}
            </button>
            <button className={btnPrimary + ' text-xs py-1 px-3'} onClick={() => onSelect(flight)}>
              Select
            </button>
          </div>
        </div>
      </div>

      {/* Segment details */}
      {expanded && flight.itineraries.map((itin, ii) => (
        <div key={ii} className="mt-3 pt-3 border-t border-gray-100">
          {flight.itineraries.length > 1 && (
            <div className="text-xs font-semibold text-indigo-700 mb-2">{ii === 0 ? 'Outbound' : 'Return'}</div>
          )}
          {itin.segments.map((seg, si) => (
            <div key={si} className="flex items-start gap-4 text-xs text-gray-600 mb-2">
              <span className="font-mono font-bold text-gray-800 w-16">{seg.flightNumber}</span>
              <div>
                <span className="font-medium">{seg.from}</span>{' '}
                {new Date(seg.fromTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' → '}
                <span className="font-medium">{seg.to}</span>{' '}
                {new Date(seg.toTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <span className="text-gray-400">{seg.duration}</span>
              <span className="text-gray-500">{seg.carrier}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────
// Approve / Reject actions (manager / admin)
// ──────────────────────────────────────────────
function ApproveRejectButtons({ request }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');

  const decide = useMutation({
    mutationFn: ({ action, note }) => api(`/api/travel/${request.id}/${action}`, { method: 'POST', body: { note } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['travel'] }); setNote(''); },
  });

  if (request.status !== 'PENDING') return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        className={inputCls + ' py-0.5 text-xs w-36'}
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <button
        className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
        onClick={() => decide.mutate({ action: 'approve', note })}
        disabled={decide.isPending}
      >Approve</button>
      <button
        className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
        onClick={() => decide.mutate({ action: 'reject', note })}
        disabled={decide.isPending}
      >Reject</button>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────
// Steps: 'search' → 'results' → 'confirm' → back to list
export default function Travel() {
  const { user, tenant } = useAuth();
  const qc = useQueryClient();
  const cur = tenant?.currency || 'USD';
  const isManager = user.role !== 'EMPLOYEE';

  // Step state
  const [step, setStep] = useState('search'); // 'search' | 'results' | 'confirm'
  const [error, setError] = useState('');

  // Search form
  const [tripType, setTripType] = useState('ONE_WAY');
  const [fromAirport, setFromAirport] = useState(null);
  const [toAirport, setToAirport] = useState(null);
  const [departDate, setDepartDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [purpose, setPurpose] = useState('');

  // Results
  const [flights, setFlights] = useState([]);
  const [budget, setBudget] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Confirmation
  const [selectedFlight, setSelectedFlight] = useState(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['travel'],
    queryFn: () => api('/api/travel'),
  });

  const confirmBooking = useMutation({
    mutationFn: (id) => api(`/api/travel/${id}/confirm-booking`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['travel'] }),
  });

  const submit = useMutation({
    mutationFn: (body) => api('/api/travel', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travel'] });
      setStep('search');
      setSelectedFlight(null);
      setPurpose('');
      setFromAirport(null);
      setToAirport(null);
      setDepartDate('');
      setReturnDate('');
      setError('');
    },
    onError: (e) => setError(e.message),
  });

  const handleSearch = async () => {
    setSearchError('');
    if (!fromAirport) return setSearchError('Please select a departure airport.');
    if (!toAirport) return setSearchError('Please select a destination airport.');
    if (!departDate) return setSearchError('Please select a departure date.');
    if (tripType === 'ROUND_TRIP' && !returnDate) return setSearchError('Please select a return date.');
    if (!purpose.trim()) return setSearchError('Please enter the trip purpose.');

    setSearching(true);
    try {
      const params = new URLSearchParams({
        origin: fromAirport.iataCode,
        destination: toAirport.iataCode,
        departureDate: departDate,
        ...(tripType === 'ROUND_TRIP' && returnDate ? { returnDate } : {}),
        adults: '1',
      });
      const data = await api(`/api/travel/search?${params}`);
      setFlights(data.flights || []);
      setBudget(data.budget);
      setStep('results');
    } catch (e) {
      setSearchError(e.message);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectFlight = (flight) => {
    setSelectedFlight(flight);
    setStep('confirm');
  };

  const handleSubmit = () => {
    if (!selectedFlight) return;
    const itin = selectedFlight.itineraries[0];
    submit.mutate({
      origin: fromAirport.iataCode,
      destination: toAirport.iataCode,
      tripType,
      startDate: departDate,
      endDate: tripType === 'ROUND_TRIP' && returnDate ? returnDate : (itin.arrival.at.split('T')[0] || departDate),
      purpose,
      estimatedCost: selectedFlight.price,
      fullPrice: null,
      flightData: selectedFlight,
    });
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Business Travel</h1>
        {step !== 'search' && (
          <button className={btnGhost} onClick={() => setStep('search')}>← Back to search</button>
        )}
      </div>

      {/* ─── Step 1: Search form ─── */}
      {step === 'search' && (
        <Card title="Search flights">
          {/* Trip type toggle */}
          <div className="flex gap-2 mb-4">
            {['ONE_WAY', 'ROUND_TRIP'].map((t) => (
              <button
                key={t}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  tripType === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setTripType(t)}
              >
                {t === 'ONE_WAY' ? 'One-way' : 'Round trip'}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Field label="From">
              <AirportInput
                value={fromAirport}
                onChange={setFromAirport}
                placeholder="City or airport (e.g. New York)"
              />
            </Field>
            <Field label="To">
              <AirportInput
                value={toAirport}
                onChange={setToAirport}
                placeholder="City or airport (e.g. London)"
              />
            </Field>
            <Field label="Departure date">
              <input className={inputCls} type="date" min={today} value={departDate} onChange={(e) => setDepartDate(e.target.value)} />
            </Field>
            {tripType === 'ROUND_TRIP' ? (
              <Field label="Return date">
                <input className={inputCls} type="date" min={departDate || today} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </Field>
            ) : <div />}
            <Field label="Purpose" className="md:col-span-2">
              <input
                className={inputCls}
                placeholder="E.g. Client meeting, Conference, Sales visit"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </Field>
          </div>

          {searchError && <p className="text-red-600 text-sm mt-2">{searchError}</p>}

          <div className="mt-4">
            <button className={btnPrimary} disabled={searching} onClick={handleSearch}>
              {searching ? 'Searching…' : '🔍 Search flights'}
            </button>
          </div>
        </Card>
      )}

      {/* ─── Step 2: Flight results ─── */}
      {step === 'results' && (
        <Card title={`Available flights — ${fromAirport?.cityName} (${fromAirport?.iataCode}) → ${toAirport?.cityName} (${toAirport?.iataCode})`}>
          {budget != null && (
            <div className="mb-4 p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-sm text-indigo-800">
              Your travel budget: <strong>{fmtMoney(budget, cur)}</strong> per trip
            </div>
          )}
          {flights.length === 0 ? (
            <Empty text="No flights found for these dates. Try different dates or airports." />
          ) : (
            <div className="space-y-3">
              {flights.map((f) => (
                <FlightCard
                  key={f.offerId}
                  flight={f}
                  budget={budget}
                  currency={cur}
                  onSelect={handleSelectFlight}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ─── Step 3: Confirm & submit ─── */}
      {step === 'confirm' && selectedFlight && (
        <Card title="Confirm your trip request">
          <div className="space-y-4">
            {/* Flight summary */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-gray-900 text-lg">
                    {fromAirport?.cityName} ({fromAirport?.iataCode}) → {toAirport?.cityName} ({toAirport?.iataCode})
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {tripType === 'ROUND_TRIP' ? 'Round trip' : 'One-way'} · {selectedFlight.airline}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Depart: {new Date(departDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    {tripType === 'ROUND_TRIP' && returnDate && (
                      <> · Return: {new Date(returnDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Purpose: <span className="font-medium">{purpose}</span></div>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${budget != null && selectedFlight.price > budget ? 'text-red-600' : 'text-gray-900'}`}>
                    {fmtMoney(selectedFlight.price, cur)}
                  </div>
                  {budget != null && (
                    selectedFlight.price > budget ? (
                      <div className="text-xs text-red-500 mt-0.5">⚠ Exceeds budget ({fmtMoney(budget, cur)})</div>
                    ) : (
                      <div className="text-xs text-green-600 mt-0.5">✓ Within budget</div>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Itinerary breakdown */}
            {selectedFlight.itineraries.map((itin, ii) => (
              <div key={ii} className="border border-gray-200 rounded-lg p-3">
                {selectedFlight.itineraries.length > 1 && (
                  <div className="text-xs font-semibold text-indigo-700 mb-2">{ii === 0 ? 'Outbound' : 'Return'}</div>
                )}
                {itin.segments.map((seg, si) => (
                  <div key={si} className="flex items-center gap-4 text-sm text-gray-700 py-1">
                    <span className="font-mono font-bold text-gray-800 w-16">{seg.flightNumber}</span>
                    <span>
                      <strong>{seg.from}</strong> {new Date(seg.fromTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' → '}
                      <strong>{seg.to}</strong> {new Date(seg.toTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-gray-400 text-xs">{seg.duration}</span>
                    <span className="text-gray-500 text-xs">{seg.carrier}</span>
                  </div>
                ))}
              </div>
            ))}

            {budget != null && selectedFlight.price > budget && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                This flight exceeds your approved travel budget. Your manager will still see the request but it will be flagged as out-of-policy.
              </div>
            )}

            <ErrorMsg error={error} />

            <div className="flex gap-3">
              <button
                className={btnPrimary}
                disabled={submit.isPending}
                onClick={handleSubmit}
              >
                {submit.isPending ? 'Submitting…' : 'Submit for HR approval'}
              </button>
              <button className={btnGhost} onClick={() => setStep('results')}>← Change flight</button>
            </div>
          </div>
        </Card>
      )}

      {/* ─── Trips list ─── */}
      <Card title="My trips">
        {isLoading ? <Empty text="Loading…" /> : !requests.length ? <Empty text="No trips yet." /> : (
          <div className="overflow-x-auto">
            <Table cols={['Route', 'Dates', 'Purpose', 'Cost', 'Policy', 'Status', 'Actions']}>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="py-2 pr-4">
                    <div className="font-medium text-gray-900">
                      {r.origin ? `${r.origin} → ` : ''}{r.destination}
                    </div>
                    <div className="text-xs text-gray-400">{r.tripType === 'ROUND_TRIP' ? 'Round trip' : 'One-way'} · {r.user.firstName} {r.user.lastName}</div>
                  </td>
                  <td className="py-2 pr-4 text-sm whitespace-nowrap">{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</td>
                  <td className="py-2 pr-4 text-sm text-gray-600 max-w-xs truncate">{r.purpose}</td>
                  <td className="py-2 pr-4 text-sm font-medium">{fmtMoney(r.estimatedCost, cur)}</td>
                  <td className="py-2 pr-4">
                    {r.policyCompliant == null ? <span className="text-gray-400 text-xs">—</span>
                      : r.policyCompliant
                        ? <span className="text-green-700 text-xs">✓ Compliant</span>
                        : <span className="text-red-600 text-xs" title={r.policyNotes || ''}>✗ Out of policy</span>}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge value={r.status} />
                    {r.status === 'APPROVED' && (
                      <div className="text-xs text-gray-400 mt-0.5">{r.bookingConfirmed ? '✓ Booked' : 'Pending booking'}</div>
                    )}
                    {r.decisionNote && <div className="text-xs text-gray-400 mt-0.5 italic">{r.decisionNote}</div>}
                  </td>
                  <td className="py-2 text-sm">
                    <div className="flex flex-col gap-1">
                      {isManager && <ApproveRejectButtons request={r} />}
                      {isManager && r.status === 'APPROVED' && !r.bookingConfirmed && (
                        <button
                          className="text-indigo-600 text-xs hover:underline"
                          onClick={() => confirmBooking.mutate(r.id)}
                        >
                          Mark booked
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
