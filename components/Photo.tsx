/* eslint-disable @next/next/no-img-element -- images are pre-sized WebP in /public; no optimizer round trip needed */
import { blur } from "@/lib/blur";

/**
 * Pre-optimized photo from /public/photos/{name}-{800|1600}.webp.
 * Paints a 24px blurred preview instantly, the real image fades over it.
 */
export default function Photo({
  name,
  alt,
  sizes = "100vw",
  className = "",
  priority = false,
}: {
  name: string;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={`/photos/${name}-1600.webp`}
      srcSet={`/photos/${name}-800.webp 800w, /photos/${name}-1600.webp 1600w`}
      sizes={sizes}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      style={blur[name] ? { backgroundImage: `url(${blur[name]})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      className={`object-cover ${className}`}
    />
  );
}
