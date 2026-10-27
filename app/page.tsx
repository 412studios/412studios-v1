import Link from "next/link";
import InViewVideo from "@/components/InViewVideo";
import MembershipCards from "@/components/MembershipCards";
import Photo from "@/components/Photo";
import SpaceExplorer from "@/components/SpaceExplorer";
import { loadStudios } from "@/lib/pricing";
import { bestSavings, cheapestMembership, money } from "@/lib/studios";
import { FaApple, FaInstagram, FaSpotify, FaTiktok, FaYoutube } from "react-icons/fa";

// Same links and icons as the old site's roster.
const icons = { Instagram: FaInstagram, TikTok: FaTiktok, YouTube: FaYoutube, Spotify: FaSpotify, "Apple Music": FaApple };
type Platform = keyof typeof icons;

const artists: { name: string; photo: string; bio: string; links: [Platform, string][] }[] = [
  {
    name: "Rans Gundo",
    photo: "artist-rans",
    bio: "Alternative rock artist from Mississauga, Ontario. Jangly, guitar-driven music with emotional depth and strong melodic instincts.",
    links: [
      ["Instagram", "https://www.instagram.com/ransgundo/"],
      ["YouTube", "https://www.youtube.com/@ransgundo1064"],
      ["Spotify", "https://open.spotify.com/artist/3cUNSMHILGtCTtonHb5znl"],
      ["Apple Music", "https://music.apple.com/us/artist/rans-gundo/1857141015"],
    ],
  },
  {
    name: "Sainty",
    photo: "artist-sainty",
    bio: "Canadian alternative pop artist from Mississauga, Ontario. Cinematic, emotionally honest music rooted in personal experience.",
    links: [
      ["Instagram", "https://www.instagram.com/saintydaisy/"],
      ["TikTok", "https://www.tiktok.com/@saintydaisy"],
      ["YouTube", "https://www.youtube.com/@saintydaisy"],
      ["Spotify", "https://open.spotify.com/artist/0N8qkwDJQxxGi4Dj1cTZ4Z"],
      ["Apple Music", "https://music.apple.com/us/artist/sainty/1578969222"],
    ],
  },
];

// Swap these for the owner's starred Dropbox picks.
const life = [
  { name: "life-live", alt: "Live performance in haze at 412" },
  { name: "life-band", alt: "Band rehearsing beside the Christmas tree" },
  { name: "life-crowd", alt: "A packed listening session" },
  { name: "life-guitar", alt: "Guitarist playing by the window" },
];

export default async function Home() {
  const studios = await loadStudios();
  const save = bestSavings(studios);

  return (
    <>
      {/* HERO: what you can do + both ways to pay, above the fold on every screen */}
      <section className="bg-brand">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:py-20">
          <p className="text-xs font-extrabold uppercase tracking-wide sm:text-sm">412 Richmond St E · Toronto · The former House of Balloons</p>
          <h1 className="display mt-3 text-[2.9rem] sm:text-7xl lg:text-8xl">
            Record where
            <br />
            the legacy lives.
          </h1>
          <p className="mt-4 max-w-xl text-base font-medium sm:mt-6 sm:text-lg">
            Fully treated studios in downtown Toronto. Book by the hour or lock in a membership. Pay online in about a minute,
            no account needed.
          </p>
          <div className="mt-6 grid gap-3 sm:mt-8 sm:flex">
            <Link href="/book" className="btn bg-ink text-brand hover:bg-cream hover:text-ink">
              Book a session
            </Link>
            <Link href="/book?plan=membership" className="btn btn-ghost">
              Memberships · save up to {save}%
            </Link>
          </div>
        </div>
      </section>

      <section id="explore" className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
        <h2 className="display text-4xl sm:text-5xl">Step inside</h2>
        <p className="mb-5 mt-2 max-w-xl">Walk through Studio A. Tap the markers to look around, then book the room.</p>
        <SpaceExplorer />
      </section>

      <section id="studios" className="mx-auto max-w-6xl px-4 pb-14">
        <h2 className="display text-4xl sm:text-5xl">The studios</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {studios.map((s) => (
            <article key={s.id} className={`flex flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white ${!s.available ? "opacity-60" : ""}`}>
              <div className="relative aspect-[4/3]">
                <Photo name={s.photo} alt={`Inside ${s.name}`} sizes="(min-width: 768px) 33vw, 100vw" className="absolute inset-0 h-full w-full" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="display text-3xl">{s.name}</h3>
                <p className="mt-2 text-sm text-neutral-700">{s.blurb}</p>
                <p className="mt-4 font-bold">
                  {money(s.hourly)}/hr · {money(s.day)}/day
                </p>
                <div className="mt-auto grid gap-2 pt-5">
                  {s.available ? (
                    <>
                      <Link href={`/book?studio=${s.id}`} className="btn btn-primary">
                        Book {s.name}
                      </Link>
                      <Link href="/book?plan=membership" className="text-center text-sm font-bold underline">
                        or 8 hrs for {money(s.memberships[8])} with a membership
                      </Link>
                    </>
                  ) : (
                    <span className="btn btn-ghost pointer-events-none opacity-60">Currently unavailable</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="memberships" className="bg-ink text-cream">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <p className="inline-block rounded-full bg-brand px-3 py-1 text-xs font-black uppercase text-ink">Save up to {save}%</p>
          <h2 className="display mt-4 text-5xl text-brand sm:text-7xl">Memberships</h2>
          <p className="mb-8 mt-3 max-w-xl text-lg">
            Recording regularly? Prepay your hours from {money(cheapestMembership(studios))} and use them across as many sessions as
            you like. Buy online right now, no message needed.
          </p>
          <MembershipCards studios={studios} dark />
        </div>
      </section>

      <section id="life" className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="display text-4xl sm:text-5xl">Life at 412</h2>
        <p className="mb-6 mt-2 max-w-xl">Sessions, shows and Sunday nights.</p>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          <InViewVideo name="live-session" label="Live band session filmed at 412" className="aspect-[9/16] w-[70vw] shrink-0 snap-center rounded-2xl border-2 border-ink md:row-span-2 md:h-full md:w-full" />
          {life.slice(0, 2).map((p) => (
            <Photo key={p.name} name={p.name} alt={p.alt} sizes="(min-width: 768px) 25vw, 70vw" className="aspect-[3/4] w-[70vw] shrink-0 snap-center rounded-2xl border-2 border-ink md:w-full" />
          ))}
          <InViewVideo name="strings" label="String ensemble recording at 412" className="aspect-[9/16] w-[70vw] shrink-0 snap-center rounded-2xl border-2 border-ink md:row-span-2 md:h-full md:w-full" />
          {life.slice(2).map((p) => (
            <Photo key={p.name} name={p.name} alt={p.alt} sizes="(min-width: 768px) 25vw, 70vw" className="aspect-[3/4] w-[70vw] shrink-0 snap-center rounded-2xl border-2 border-ink md:w-full" />
          ))}
        </div>
      </section>

      <section id="artists" className="mx-auto max-w-6xl px-4 pb-14">
        <h2 className="display text-4xl sm:text-5xl">Artists</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {artists.map((a) => (
            <article key={a.name} className="flex overflow-hidden rounded-2xl border-2 border-ink bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/photos/${a.photo}.webp`} alt={a.name} loading="lazy" className="w-32 shrink-0 object-cover sm:w-44" />
              <div className="p-5">
                <h3 className="display text-3xl">{a.name}</h3>
                <p className="mt-2 text-sm">{a.bio}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {a.links.map(([platform, href]) => {
                    const Icon = icons[platform];
                    return (
                      <li key={platform}>
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${a.name} on ${platform}`}
                          className="flex min-h-9 items-center gap-1.5 rounded-full border-2 border-ink px-3 text-xs font-black uppercase transition-colors hover:bg-ink hover:text-brand"
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                          {platform}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-brand">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="display text-4xl sm:text-5xl">Our origin</h2>
          <div className="mt-6 space-y-4 text-lg leading-relaxed">
            <p>
              Four-One-Two is rooted in a studio with deep historical impact. Formerly known as the House of Balloons, it is
              where The Weeknd, alongside Doc McKinney and Illangelo, shaped the project that became the &ldquo;Trilogy&rdquo;.
            </p>
            <p>
              Founded in 2023 and named after the address itself, 412 exists to provide what was missing: systems, security,
              community and longevity. Not just preserving legacy. Building the next one.
            </p>
          </div>
          <Link href="/book" className="btn mt-8 bg-ink text-brand">
            Book your session
          </Link>
        </div>
      </section>
    </>
  );
}
