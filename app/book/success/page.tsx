import Link from "next/link";

export default async function Success({ searchParams }: PageProps<"/book/success">) {
  const { type } = await searchParams;
  const membership = type === "membership";

  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="display text-5xl">{membership ? "You’re a member." : "You’re booked."}</h1>
      <p className="mt-4 text-lg">
        Your receipt is on its way to your email.{" "}
        {membership ? "Your hours are in your account, ready to book." : "See you at 412 Richmond St E."}
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {membership ? (
          <Link href="/account" className="btn btn-primary">See my hours</Link>
        ) : (
          <Link href="/" className="btn btn-primary">Back home</Link>
        )}
      </div>
    </div>
  );
}
