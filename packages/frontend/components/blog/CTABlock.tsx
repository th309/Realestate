import Link from "next/link";

interface CTABlockProps {
  heading: string;
  body: string;
  cta: string;
  href: string;
}

export function CTABlock({ heading, body, cta, href }: CTABlockProps) {
  return (
    <aside className="my-10 rounded-xl bg-primary-container p-8 not-prose">
      <h3 className="text-xl font-semibold text-on-primary-container mb-2">
        {heading}
      </h3>
      <p className="text-on-primary-container/80 mb-5 leading-relaxed">
        {body}
      </p>
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors duration-200"
      >
        {cta}
        <span aria-hidden="true">→</span>
      </Link>
    </aside>
  );
}
