// Static airport/city list for autocomplete — top ~220 business travel airports worldwide.
// No external API needed. Filter by city name or IATA code.

const AIRPORTS = [
  // North America
  { iataCode: 'JFK', cityName: 'New York', name: 'John F. Kennedy International', countryCode: 'US' },
  { iataCode: 'LGA', cityName: 'New York', name: 'LaGuardia Airport', countryCode: 'US' },
  { iataCode: 'EWR', cityName: 'Newark', name: 'Newark Liberty International', countryCode: 'US' },
  { iataCode: 'LAX', cityName: 'Los Angeles', name: 'Los Angeles International', countryCode: 'US' },
  { iataCode: 'ORD', cityName: 'Chicago', name: "O'Hare International", countryCode: 'US' },
  { iataCode: 'MDW', cityName: 'Chicago', name: 'Chicago Midway International', countryCode: 'US' },
  { iataCode: 'ATL', cityName: 'Atlanta', name: 'Hartsfield-Jackson Atlanta International', countryCode: 'US' },
  { iataCode: 'DFW', cityName: 'Dallas', name: 'Dallas/Fort Worth International', countryCode: 'US' },
  { iataCode: 'DAL', cityName: 'Dallas', name: 'Dallas Love Field', countryCode: 'US' },
  { iataCode: 'DEN', cityName: 'Denver', name: 'Denver International', countryCode: 'US' },
  { iataCode: 'SFO', cityName: 'San Francisco', name: 'San Francisco International', countryCode: 'US' },
  { iataCode: 'OAK', cityName: 'Oakland', name: 'Oakland International', countryCode: 'US' },
  { iataCode: 'SJC', cityName: 'San Jose', name: 'Norman Y. Mineta San Jose International', countryCode: 'US' },
  { iataCode: 'SEA', cityName: 'Seattle', name: 'Seattle-Tacoma International', countryCode: 'US' },
  { iataCode: 'MIA', cityName: 'Miami', name: 'Miami International', countryCode: 'US' },
  { iataCode: 'FLL', cityName: 'Fort Lauderdale', name: 'Fort Lauderdale-Hollywood International', countryCode: 'US' },
  { iataCode: 'MCO', cityName: 'Orlando', name: 'Orlando International', countryCode: 'US' },
  { iataCode: 'BOS', cityName: 'Boston', name: 'Logan International', countryCode: 'US' },
  { iataCode: 'IAD', cityName: 'Washington DC', name: 'Dulles International', countryCode: 'US' },
  { iataCode: 'DCA', cityName: 'Washington DC', name: 'Ronald Reagan Washington National', countryCode: 'US' },
  { iataCode: 'BWI', cityName: 'Baltimore', name: 'Baltimore/Washington International', countryCode: 'US' },
  { iataCode: 'PHX', cityName: 'Phoenix', name: 'Phoenix Sky Harbor International', countryCode: 'US' },
  { iataCode: 'LAS', cityName: 'Las Vegas', name: 'Harry Reid International', countryCode: 'US' },
  { iataCode: 'MSP', cityName: 'Minneapolis', name: 'Minneapolis-Saint Paul International', countryCode: 'US' },
  { iataCode: 'DTW', cityName: 'Detroit', name: 'Detroit Metropolitan Wayne County', countryCode: 'US' },
  { iataCode: 'PHL', cityName: 'Philadelphia', name: 'Philadelphia International', countryCode: 'US' },
  { iataCode: 'CLT', cityName: 'Charlotte', name: 'Charlotte Douglas International', countryCode: 'US' },
  { iataCode: 'SLC', cityName: 'Salt Lake City', name: 'Salt Lake City International', countryCode: 'US' },
  { iataCode: 'IAH', cityName: 'Houston', name: 'George Bush Intercontinental', countryCode: 'US' },
  { iataCode: 'HOU', cityName: 'Houston', name: 'William P. Hobby Airport', countryCode: 'US' },
  { iataCode: 'PDX', cityName: 'Portland', name: 'Portland International', countryCode: 'US' },
  { iataCode: 'SAN', cityName: 'San Diego', name: 'San Diego International', countryCode: 'US' },
  { iataCode: 'TPA', cityName: 'Tampa', name: 'Tampa International', countryCode: 'US' },
  { iataCode: 'MSY', cityName: 'New Orleans', name: 'Louis Armstrong New Orleans International', countryCode: 'US' },
  { iataCode: 'STL', cityName: 'St. Louis', name: 'St. Louis Lambert International', countryCode: 'US' },
  { iataCode: 'AUS', cityName: 'Austin', name: 'Austin-Bergstrom International', countryCode: 'US' },
  { iataCode: 'BNA', cityName: 'Nashville', name: 'Nashville International', countryCode: 'US' },
  { iataCode: 'RDU', cityName: 'Raleigh', name: 'Raleigh-Durham International', countryCode: 'US' },
  { iataCode: 'MCI', cityName: 'Kansas City', name: 'Kansas City International', countryCode: 'US' },
  { iataCode: 'PIT', cityName: 'Pittsburgh', name: 'Pittsburgh International', countryCode: 'US' },
  { iataCode: 'IND', cityName: 'Indianapolis', name: 'Indianapolis International', countryCode: 'US' },
  { iataCode: 'CMH', cityName: 'Columbus', name: 'John Glenn Columbus International', countryCode: 'US' },
  { iataCode: 'BDL', cityName: 'Hartford', name: 'Bradley International', countryCode: 'US' },
  { iataCode: 'BUF', cityName: 'Buffalo', name: 'Buffalo Niagara International', countryCode: 'US' },
  { iataCode: 'OMA', cityName: 'Omaha', name: 'Eppley Airfield', countryCode: 'US' },
  { iataCode: 'MKE', cityName: 'Milwaukee', name: 'Milwaukee Mitchell International', countryCode: 'US' },
  // Canada
  { iataCode: 'YYZ', cityName: 'Toronto', name: 'Toronto Pearson International', countryCode: 'CA' },
  { iataCode: 'YUL', cityName: 'Montreal', name: 'Montréal-Pierre Elliott Trudeau International', countryCode: 'CA' },
  { iataCode: 'YVR', cityName: 'Vancouver', name: 'Vancouver International', countryCode: 'CA' },
  { iataCode: 'YYC', cityName: 'Calgary', name: 'Calgary International', countryCode: 'CA' },
  { iataCode: 'YEG', cityName: 'Edmonton', name: 'Edmonton International', countryCode: 'CA' },
  { iataCode: 'YOW', cityName: 'Ottawa', name: 'Ottawa Macdonald–Cartier International', countryCode: 'CA' },
  // Mexico
  { iataCode: 'MEX', cityName: 'Mexico City', name: 'Benito Juárez International', countryCode: 'MX' },
  { iataCode: 'CUN', cityName: 'Cancún', name: 'Cancún International', countryCode: 'MX' },
  { iataCode: 'GDL', cityName: 'Guadalajara', name: 'Miguel Hidalgo y Costilla International', countryCode: 'MX' },
  { iataCode: 'MTY', cityName: 'Monterrey', name: 'General Mariano Escobedo International', countryCode: 'MX' },
  // UK & Ireland
  { iataCode: 'LHR', cityName: 'London', name: 'Heathrow Airport', countryCode: 'GB' },
  { iataCode: 'LGW', cityName: 'London', name: 'Gatwick Airport', countryCode: 'GB' },
  { iataCode: 'STN', cityName: 'London', name: 'Stansted Airport', countryCode: 'GB' },
  { iataCode: 'LCY', cityName: 'London', name: 'City Airport', countryCode: 'GB' },
  { iataCode: 'MAN', cityName: 'Manchester', name: 'Manchester Airport', countryCode: 'GB' },
  { iataCode: 'EDI', cityName: 'Edinburgh', name: 'Edinburgh Airport', countryCode: 'GB' },
  { iataCode: 'BHX', cityName: 'Birmingham', name: 'Birmingham Airport', countryCode: 'GB' },
  { iataCode: 'GLA', cityName: 'Glasgow', name: 'Glasgow Airport', countryCode: 'GB' },
  { iataCode: 'DUB', cityName: 'Dublin', name: 'Dublin Airport', countryCode: 'IE' },
  // Europe
  { iataCode: 'CDG', cityName: 'Paris', name: 'Charles de Gaulle Airport', countryCode: 'FR' },
  { iataCode: 'ORY', cityName: 'Paris', name: 'Orly Airport', countryCode: 'FR' },
  { iataCode: 'AMS', cityName: 'Amsterdam', name: 'Amsterdam Schiphol Airport', countryCode: 'NL' },
  { iataCode: 'FRA', cityName: 'Frankfurt', name: 'Frankfurt Airport', countryCode: 'DE' },
  { iataCode: 'MUC', cityName: 'Munich', name: 'Munich Airport', countryCode: 'DE' },
  { iataCode: 'BER', cityName: 'Berlin', name: 'Berlin Brandenburg Airport', countryCode: 'DE' },
  { iataCode: 'HAM', cityName: 'Hamburg', name: 'Hamburg Airport', countryCode: 'DE' },
  { iataCode: 'DUS', cityName: 'Düsseldorf', name: 'Düsseldorf Airport', countryCode: 'DE' },
  { iataCode: 'FCO', cityName: 'Rome', name: 'Leonardo da Vinci–Fiumicino Airport', countryCode: 'IT' },
  { iataCode: 'MXP', cityName: 'Milan', name: 'Milan Malpensa Airport', countryCode: 'IT' },
  { iataCode: 'LIN', cityName: 'Milan', name: 'Milan Linate Airport', countryCode: 'IT' },
  { iataCode: 'VCE', cityName: 'Venice', name: 'Venice Marco Polo Airport', countryCode: 'IT' },
  { iataCode: 'NAP', cityName: 'Naples', name: 'Naples International Airport', countryCode: 'IT' },
  { iataCode: 'MAD', cityName: 'Madrid', name: 'Adolfo Suárez Madrid–Barajas Airport', countryCode: 'ES' },
  { iataCode: 'BCN', cityName: 'Barcelona', name: 'Barcelona–El Prat Airport', countryCode: 'ES' },
  { iataCode: 'ZRH', cityName: 'Zurich', name: 'Zurich Airport', countryCode: 'CH' },
  { iataCode: 'GVA', cityName: 'Geneva', name: 'Geneva Airport', countryCode: 'CH' },
  { iataCode: 'VIE', cityName: 'Vienna', name: 'Vienna International Airport', countryCode: 'AT' },
  { iataCode: 'BRU', cityName: 'Brussels', name: 'Brussels Airport', countryCode: 'BE' },
  { iataCode: 'CPH', cityName: 'Copenhagen', name: 'Copenhagen Airport', countryCode: 'DK' },
  { iataCode: 'ARN', cityName: 'Stockholm', name: 'Stockholm Arlanda Airport', countryCode: 'SE' },
  { iataCode: 'OSL', cityName: 'Oslo', name: 'Oslo Gardermoen Airport', countryCode: 'NO' },
  { iataCode: 'HEL', cityName: 'Helsinki', name: 'Helsinki-Vantaa Airport', countryCode: 'FI' },
  { iataCode: 'LIS', cityName: 'Lisbon', name: 'Humberto Delgado Airport', countryCode: 'PT' },
  { iataCode: 'ATH', cityName: 'Athens', name: 'Athens International Airport', countryCode: 'GR' },
  { iataCode: 'WAW', cityName: 'Warsaw', name: 'Warsaw Chopin Airport', countryCode: 'PL' },
  { iataCode: 'PRG', cityName: 'Prague', name: 'Václav Havel Airport Prague', countryCode: 'CZ' },
  { iataCode: 'BUD', cityName: 'Budapest', name: 'Budapest Ferenc Liszt International', countryCode: 'HU' },
  { iataCode: 'SVO', cityName: 'Moscow', name: 'Sheremetyevo International Airport', countryCode: 'RU' },
  { iataCode: 'LED', cityName: 'St. Petersburg', name: 'Pulkovo Airport', countryCode: 'RU' },
  { iataCode: 'IST', cityName: 'Istanbul', name: 'Istanbul Airport', countryCode: 'TR' },
  { iataCode: 'SAW', cityName: 'Istanbul', name: 'Sabiha Gökçen International', countryCode: 'TR' },
  { iataCode: 'OTP', cityName: 'Bucharest', name: 'Henri Coandă International Airport', countryCode: 'RO' },
  // Middle East
  { iataCode: 'DXB', cityName: 'Dubai', name: 'Dubai International Airport', countryCode: 'AE' },
  { iataCode: 'AUH', cityName: 'Abu Dhabi', name: 'Abu Dhabi International Airport', countryCode: 'AE' },
  { iataCode: 'DOH', cityName: 'Doha', name: 'Hamad International Airport', countryCode: 'QA' },
  { iataCode: 'RUH', cityName: 'Riyadh', name: 'King Khalid International Airport', countryCode: 'SA' },
  { iataCode: 'JED', cityName: 'Jeddah', name: 'King Abdulaziz International Airport', countryCode: 'SA' },
  { iataCode: 'KWI', cityName: 'Kuwait City', name: 'Kuwait International Airport', countryCode: 'KW' },
  { iataCode: 'BAH', cityName: 'Manama', name: 'Bahrain International Airport', countryCode: 'BH' },
  { iataCode: 'MCT', cityName: 'Muscat', name: 'Muscat International Airport', countryCode: 'OM' },
  { iataCode: 'TLV', cityName: 'Tel Aviv', name: 'Ben Gurion International Airport', countryCode: 'IL' },
  { iataCode: 'AMM', cityName: 'Amman', name: 'Queen Alia International Airport', countryCode: 'JO' },
  { iataCode: 'BEY', cityName: 'Beirut', name: 'Rafic Hariri International Airport', countryCode: 'LB' },
  // Asia Pacific
  { iataCode: 'HND', cityName: 'Tokyo', name: 'Haneda Airport', countryCode: 'JP' },
  { iataCode: 'NRT', cityName: 'Tokyo', name: 'Narita International Airport', countryCode: 'JP' },
  { iataCode: 'KIX', cityName: 'Osaka', name: 'Kansai International Airport', countryCode: 'JP' },
  { iataCode: 'ITM', cityName: 'Osaka', name: 'Itami Airport', countryCode: 'JP' },
  { iataCode: 'NGO', cityName: 'Nagoya', name: 'Chubu Centrair International', countryCode: 'JP' },
  { iataCode: 'FUK', cityName: 'Fukuoka', name: 'Fukuoka Airport', countryCode: 'JP' },
  { iataCode: 'ICN', cityName: 'Seoul', name: 'Incheon International Airport', countryCode: 'KR' },
  { iataCode: 'GMP', cityName: 'Seoul', name: 'Gimpo International Airport', countryCode: 'KR' },
  { iataCode: 'PEK', cityName: 'Beijing', name: 'Beijing Capital International Airport', countryCode: 'CN' },
  { iataCode: 'PKX', cityName: 'Beijing', name: 'Beijing Daxing International Airport', countryCode: 'CN' },
  { iataCode: 'PVG', cityName: 'Shanghai', name: 'Shanghai Pudong International Airport', countryCode: 'CN' },
  { iataCode: 'SHA', cityName: 'Shanghai', name: 'Shanghai Hongqiao International Airport', countryCode: 'CN' },
  { iataCode: 'CAN', cityName: 'Guangzhou', name: 'Guangzhou Baiyun International Airport', countryCode: 'CN' },
  { iataCode: 'SZX', cityName: 'Shenzhen', name: 'Shenzhen Bao\'an International Airport', countryCode: 'CN' },
  { iataCode: 'CTU', cityName: 'Chengdu', name: 'Chengdu Tianfu International Airport', countryCode: 'CN' },
  { iataCode: 'HKG', cityName: 'Hong Kong', name: 'Hong Kong International Airport', countryCode: 'HK' },
  { iataCode: 'TPE', cityName: 'Taipei', name: 'Taiwan Taoyuan International Airport', countryCode: 'TW' },
  { iataCode: 'TSA', cityName: 'Taipei', name: 'Taipei Songshan Airport', countryCode: 'TW' },
  { iataCode: 'SIN', cityName: 'Singapore', name: 'Singapore Changi Airport', countryCode: 'SG' },
  { iataCode: 'KUL', cityName: 'Kuala Lumpur', name: 'Kuala Lumpur International Airport', countryCode: 'MY' },
  { iataCode: 'BKK', cityName: 'Bangkok', name: 'Suvarnabhumi Airport', countryCode: 'TH' },
  { iataCode: 'DMK', cityName: 'Bangkok', name: 'Don Mueang International Airport', countryCode: 'TH' },
  { iataCode: 'CGK', cityName: 'Jakarta', name: 'Soekarno–Hatta International Airport', countryCode: 'ID' },
  { iataCode: 'MNL', cityName: 'Manila', name: 'Ninoy Aquino International Airport', countryCode: 'PH' },
  { iataCode: 'SGN', cityName: 'Ho Chi Minh City', name: 'Tan Son Nhat International Airport', countryCode: 'VN' },
  { iataCode: 'HAN', cityName: 'Hanoi', name: 'Noi Bai International Airport', countryCode: 'VN' },
  { iataCode: 'REP', cityName: 'Siem Reap', name: 'Siem Reap International Airport', countryCode: 'KH' },
  { iataCode: 'RGN', cityName: 'Yangon', name: 'Yangon International Airport', countryCode: 'MM' },
  // India
  { iataCode: 'DEL', cityName: 'Delhi', name: 'Indira Gandhi International Airport', countryCode: 'IN' },
  { iataCode: 'BOM', cityName: 'Mumbai', name: 'Chhatrapati Shivaji Maharaj International', countryCode: 'IN' },
  { iataCode: 'BLR', cityName: 'Bengaluru', name: 'Kempegowda International Airport', countryCode: 'IN' },
  { iataCode: 'MAA', cityName: 'Chennai', name: 'Chennai International Airport', countryCode: 'IN' },
  { iataCode: 'HYD', cityName: 'Hyderabad', name: 'Rajiv Gandhi International Airport', countryCode: 'IN' },
  { iataCode: 'CCU', cityName: 'Kolkata', name: 'Netaji Subhas Chandra Bose International', countryCode: 'IN' },
  { iataCode: 'AMD', cityName: 'Ahmedabad', name: 'Sardar Vallabhbhai Patel International', countryCode: 'IN' },
  { iataCode: 'PNQ', cityName: 'Pune', name: 'Pune Airport', countryCode: 'IN' },
  // Australia & NZ
  { iataCode: 'SYD', cityName: 'Sydney', name: 'Sydney Kingsford Smith Airport', countryCode: 'AU' },
  { iataCode: 'MEL', cityName: 'Melbourne', name: 'Melbourne Airport', countryCode: 'AU' },
  { iataCode: 'BNE', cityName: 'Brisbane', name: 'Brisbane Airport', countryCode: 'AU' },
  { iataCode: 'PER', cityName: 'Perth', name: 'Perth Airport', countryCode: 'AU' },
  { iataCode: 'ADL', cityName: 'Adelaide', name: 'Adelaide Airport', countryCode: 'AU' },
  { iataCode: 'AKL', cityName: 'Auckland', name: 'Auckland Airport', countryCode: 'NZ' },
  { iataCode: 'CHC', cityName: 'Christchurch', name: 'Christchurch Airport', countryCode: 'NZ' },
  // Africa
  { iataCode: 'JNB', cityName: 'Johannesburg', name: 'O.R. Tambo International Airport', countryCode: 'ZA' },
  { iataCode: 'CPT', cityName: 'Cape Town', name: 'Cape Town International Airport', countryCode: 'ZA' },
  { iataCode: 'CAI', cityName: 'Cairo', name: 'Cairo International Airport', countryCode: 'EG' },
  { iataCode: 'CMN', cityName: 'Casablanca', name: 'Mohammed V International Airport', countryCode: 'MA' },
  { iataCode: 'LOS', cityName: 'Lagos', name: 'Murtala Muhammed International Airport', countryCode: 'NG' },
  { iataCode: 'ABV', cityName: 'Abuja', name: 'Nnamdi Azikiwe International Airport', countryCode: 'NG' },
  { iataCode: 'NBO', cityName: 'Nairobi', name: 'Jomo Kenyatta International Airport', countryCode: 'KE' },
  { iataCode: 'ADD', cityName: 'Addis Ababa', name: 'Addis Ababa Bole International Airport', countryCode: 'ET' },
  { iataCode: 'ACC', cityName: 'Accra', name: 'Kotoka International Airport', countryCode: 'GH' },
  { iataCode: 'DAR', cityName: 'Dar es Salaam', name: 'Julius Nyerere International Airport', countryCode: 'TZ' },
  // South America
  { iataCode: 'GRU', cityName: 'São Paulo', name: 'São Paulo/Guarulhos International Airport', countryCode: 'BR' },
  { iataCode: 'CGH', cityName: 'São Paulo', name: 'Congonhas Airport', countryCode: 'BR' },
  { iataCode: 'GIG', cityName: 'Rio de Janeiro', name: 'Galeão International Airport', countryCode: 'BR' },
  { iataCode: 'SDU', cityName: 'Rio de Janeiro', name: 'Santos Dumont Airport', countryCode: 'BR' },
  { iataCode: 'BSB', cityName: 'Brasília', name: 'Presidente Juscelino Kubitscheck International', countryCode: 'BR' },
  { iataCode: 'EZE', cityName: 'Buenos Aires', name: 'Ministro Pistarini International Airport', countryCode: 'AR' },
  { iataCode: 'AEP', cityName: 'Buenos Aires', name: 'Jorge Newbery Airfield', countryCode: 'AR' },
  { iataCode: 'SCL', cityName: 'Santiago', name: 'Arturo Merino Benítez International Airport', countryCode: 'CL' },
  { iataCode: 'BOG', cityName: 'Bogotá', name: 'El Dorado International Airport', countryCode: 'CO' },
  { iataCode: 'LIM', cityName: 'Lima', name: 'Jorge Chávez International Airport', countryCode: 'PE' },
  { iataCode: 'UIO', cityName: 'Quito', name: 'Mariscal Sucre International Airport', countryCode: 'EC' },
  { iataCode: 'MVD', cityName: 'Montevideo', name: 'Carrasco International Airport', countryCode: 'UY' },
  { iataCode: 'PTY', cityName: 'Panama City', name: 'Tocumen International Airport', countryCode: 'PA' },
];

// Search airports by city name, IATA code, or airport name. Returns up to 8 results.
export function searchLocations(keyword) {
  const q = keyword.toLowerCase().trim();
  if (q.length < 2) return [];

  const scored = AIRPORTS.map((a) => {
    const iata = a.iataCode.toLowerCase();
    const city = a.cityName.toLowerCase();
    const name = a.name.toLowerCase();

    // Exact IATA match → highest priority
    if (iata === q) return { a, score: 100 };
    // IATA starts with query
    if (iata.startsWith(q)) return { a, score: 90 };
    // City starts with query
    if (city.startsWith(q)) return { a, score: 80 };
    // City contains query word
    if (city.includes(q)) return { a, score: 70 };
    // Airport name contains query
    if (name.includes(q)) return { a, score: 60 };
    return { a, score: 0 };
  })
  .filter((x) => x.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 8)
  .map((x) => x.a);

  return scored;
}
