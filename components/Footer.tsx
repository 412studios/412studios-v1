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
          <p className="text-sm">Instagram @itsfouronetwo · @412.studios · TikTok @the412show</p>
        </div>
      </div>
    </footer>
  );
}
