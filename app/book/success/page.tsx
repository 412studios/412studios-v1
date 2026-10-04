import Link from "next/link";

export default async function Success({ searchParams }: PageProps<"/book/success">) {
  const { type } = await searchParams;
  const membership = type === "membership";

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="display text-5xl">{membership ? "You’re a member." : "You’re booked."}</h1>
      <p className="mt-4 text-lg">
        Your receipt is on its way to your email.{" "}
        {membership ? (
          <>
            To schedule your hours, email{" "}
            <a className="font-bold underline" href="mailto:Info@412studios.ca">Info@412studios.ca</a> or call{" "}
            <a className="font-bold underline" href="tel:+16475402321">647-540-2321</a>.
          </>
        ) : (
          "See you at 412 Richmond St E."
        )}
      </p>
      <Link href="/" className="btn btn-primary mt-8">Back home</Link>
    </div>
  );
}
