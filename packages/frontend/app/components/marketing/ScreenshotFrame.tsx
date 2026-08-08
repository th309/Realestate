import Image from "next/image";

/**
 * Consistent framing for product screenshots so they read as one set rather
 * than pasted-in pictures.
 */
export function ScreenshotFrame({
  src,
  alt,
  width,
  height,
  priority = false,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  priority?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-sm">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes="(min-width: 1024px) 640px, 100vw"
        className="h-auto w-full"
      />
    </div>
  );
}
