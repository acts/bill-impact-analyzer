import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="page narrow">
      <h1>Page not found</h1>
      <p>There is no page at this address. The analyzer lives on the home page.</p>
      <p>
        <Link href="/">Go to the analyzer</Link>
      </p>
    </main>
  );
}
