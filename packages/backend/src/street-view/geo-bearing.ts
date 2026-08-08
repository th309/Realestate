const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/**
 * Initial great-circle bearing from one coordinate to another, in compass
 * degrees (0 = north, 90 = east).
 *
 * Street View panoramas are captured from the road, so the camera's default
 * heading follows the street rather than facing any particular address. Without
 * an explicit heading the API returns whatever the car was pointed at — which
 * is usually a neighbouring property. Aiming the camera from the panorama's own
 * position at the subject coordinates is what makes the image show the right
 * house.
 */
export function bearingBetween(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
): number {
  const phi1 = toRadians(fromLat);
  const phi2 = toRadians(toLat);
  const deltaLambda = toRadians(toLon - fromLon);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}
