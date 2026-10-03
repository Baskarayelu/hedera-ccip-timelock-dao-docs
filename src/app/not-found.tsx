import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="home">
      <section className="home-hero">
        <span className="eyebrow">404</span>
        <h1 className="doc-title">This page is not in the docs</h1>
        <p style={{ margin: 0 }}>
          The address may be from an older version of the site. <Link href="/">Go to the home page</Link> or search with ⌘K.
        </p>
      </section>
    </main>
  );
}
