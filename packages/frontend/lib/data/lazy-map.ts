// Lazy Map helper used by the slug-data wrapper files.
//
// The slug data JSON files are large (zip-slug-data.json is ~8 MB / 39k entries).
// Building lookup Maps eagerly at module load time costs ~25-50 MB of permanently
// resident memory per Map, even for importers that only need the underlying array
// (e.g. app/sitemap.ts iterates ZIP_SLUG_DATA but never touches SLUG_TO_ZIP).
//
// makeLazyMap returns a Proxy that defers Map construction until the first
// property access, then forwards all operations to the real Map. The exported
// binding still has type Map<K, V>, so consumers can call .get() unchanged.

export function makeLazyMap<K, V>(builder: () => Map<K, V>): Map<K, V> {
  let built: Map<K, V> | undefined;
  const get = () => (built ??= builder());
  return new Proxy({} as Map<K, V>, {
    get(_t, prop, _r) {
      const m = get();
      const value = Reflect.get(m, prop, m);
      return typeof value === "function" ? value.bind(m) : value;
    },
    has(_t, prop) {
      return prop in get();
    },
    ownKeys() {
      return Reflect.ownKeys(get());
    },
    getOwnPropertyDescriptor(_t, prop) {
      return Object.getOwnPropertyDescriptor(get(), prop);
    },
  });
}
