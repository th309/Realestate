/**
 * Mapbox Static Images URL for the property's aerial view.
 *
 * Deliberately does NOT disable Mapbox's built-in logo/attribution: the burned-in
 * credit is what keeps this image compliant without extra markup.
 *
 * https://docs.mapbox.com/api/maps/static-images/
 */

const STYLE = "mapbox/satellite-streets-v12";
const ZOOM = 18;
const WIDTH = 640;
const HEIGHT = 400;
const PIN_HEX = "3949AB"; // PropertyIQ indigo

export function buildAerialUrl(lat: number, lon: number): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const pin = `pin-s+${PIN_HEX}(${lon},${lat})`;

  return (
    `https://api.mapbox.com/styles/v1/${STYLE}/static/` +
    `${pin}/${lon},${lat},${ZOOM}/${WIDTH}x${HEIGHT}@2x` +
    `?access_token=${encodeURIComponent(token)}`
  );
}
