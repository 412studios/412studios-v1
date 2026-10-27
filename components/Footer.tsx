import { FaInstagram, FaSoundcloud, FaTiktok, FaYoutube } from "react-icons/fa";

// The studio's own channels, as linked from the old site.
const socials = [
  { label: "Instagram", href: "https://www.instagram.com/itsfouronetwo/", Icon: FaInstagram },
  { label: "TikTok", href: "https://www.tiktok.com/@412.studios", Icon: FaTiktok },
  { label: "YouTube", href: "https://www.youtube.com/channel/UCiIHqiNLRHtjsaKBVRh0ipQ", Icon: FaYoutube },
  { label: "SoundCloud", href: "https://soundcloud.com/412studios", Icon: FaSoundcloud },
];

export default function Footer() {
  return (
    <footer id="contact" className="border-t border-ink bg-ink text-cream">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-2">
        <div>
          <p className="display text-4xl text-brand">Contact</p>
          <address className="mt-4 not-italic leading-relaxed">
            412 Richmond St E
            <br />
            Toronto, ON M5A 1P8
          </address>
        </div>
        <div className="space-y-2 sm:text-right">
          <p><a className="underline" href="mailto:Info@412studios.ca">Info@412studios.ca</a></p>
          <p><a className="underline" href="tel:+16475402321">647-540-2321</a></p>
          <ul className="flex gap-2 sm:justify-end">
            {socials.map(({ label, href, Icon }) => (
              <li key={label}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`412 Studios on ${label}`}
                  className="grid h-11 w-11 place-items-center rounded-full border-2 border-cream/40 transition-colors hover:border-brand hover:bg-brand hover:text-ink"
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
