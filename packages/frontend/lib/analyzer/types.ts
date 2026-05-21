export interface AddressSuggestion {
  id: string;
  full: string;
  street: string;
  city: string;
  state: string;
  postalCode: string | null;
  lat: number;
  lon: number;
}
