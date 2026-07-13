import type { Faq } from "@/lib/seo/faq-json-ld";

export const DOCS_API_FAQS: Faq[] = [
  {
    question: "Does PropertyIQ have a public REST API?",
    answer:
      "Yes. The PropertyIQ Platform API exposes market data, PropertyIQ Scores, and property-level analysis over HTTP so you can pull the same data that powers the PropertyIQ app directly into your own tools and workflows.",
  },
  {
    question: "How do I authenticate requests to the API?",
    answer:
      "Every request needs a Bearer token in the Authorization header. You generate an API key from your organization's Admin panel under API Keys, choose which permissions it needs, such as scores:read or metrics:read, and copy the key immediately since it is only shown once.",
  },
  {
    question: "Which PropertyIQ plan includes API access?",
    answer:
      "Platform API access is available on Enterprise plans. If your organization is on a lower tier, the API Keys panel shows API access as not enabled and directs you to contact your account manager to turn it on.",
  },
  {
    question: "What format does the PropertyIQ API return data in?",
    answer:
      "Responses are JSON, wrapped in a data field alongside a meta object with a request_id and timestamp for troubleshooting. List endpoints, like metrics or rankings, add pagination details to meta and use a cursor you pass back on the next request to page through results.",
  },
  {
    question: "Is the PropertyIQ API rate limited?",
    answer:
      "Yes, each API key has a requests-per-minute limit shown in its health check response. Exceeding it returns a 429 RATE_LIMIT_EXCEEDED error with a Retry-After header telling you how long to wait, and the health endpoint itself never counts against the limit so you can always use it to check your key.",
  },
  {
    question: "What can I build with the PropertyIQ API?",
    answer:
      "Common use cases include auto-generating a market report for a new lead, embedding a live PropertyIQ score on your website through a server-side proxy, pulling metrics into a Google Sheet on a schedule, and feeding rankings data into a CRM or internal dashboard. The docs cover ten of these walkthroughs with copy-paste code in JavaScript, Python, and curl.",
  },
];
