/**
 * Which websites count as sources of law, for the search of the chat with AI,
 * see chat-search.ts.
 *
 * NOTE: why a list in code? The search is Google Search, which cannot be
 * limited to legal sites, and returns the blogs of law firms and tutoring
 * sites next to statutes. The AI is told to prefer primary sources, but what
 * may be cited in a tree should not rest on an instruction. Here it is a
 * check that holds whatever the AI does.
 *
 * NOTE: a domain on the list says where a page is, and not that the AI read
 * it right, or that a case is still good law. Hence "not checked" in the
 * footnote of a reason, see SOURCE_SEARCH in ai-convert.ts.
 *
 * TODO: the list is a judgment, and thin outside the United States, the
 * United Kingdom, Canada, Australia, New Zealand, Ireland and the European
 * Union. Add to it as users in other places search.
 */

/**
 * - primary: a court, a legislature or a government, which publishes the law
 * - reference: a site that is known for republishing the law as it is
 * - other: anything else, like the blog of a law firm
 */
export type SourceKind = "primary" | "reference" | "other";

// NOTE: each is matched as the whole domain or as the end of it after a dot,
// so "gov" matches "courts.ca.gov" and not "gov.example.com"
const PRIMARY_DOMAINS = [
  "gov",
  "gov.uk",
  "judiciary.uk",
  "parliament.uk",
  "gc.ca",
  "canada.ca",
  "gov.au",
  "gov.nz",
  "gov.ie",
  "courts.ie",
  "europa.eu",
];

// NOTE: the older sites of the courts and legislatures of the states of the
// United States, like courts.state.ny.us
const US_STATE_DOMAIN = /(^|\.)state\.[a-z]{2}\.us$/;

// NOTE: the search gives the domain of a site without its subdomain, like
// "cornell.edu" for law.cornell.edu, when tried. So the Legal Information
// Institute of Cornell is listed by the domain of its university, which is
// wider than meant, and the case law of Google Scholar cannot be listed,
// because its domain would be that of all of Google.
//
// NOTE: findlaw.com was added after the first trials, in which a question
// on a statute of California never returned the site of its legislature,
// in six searches, and returned FindLaw in four. FindLaw republishes codes
// and opinions, and also has articles of its own, which the domain alone
// cannot tell apart.
//
// NOTE: widened after more trials, in which a search often returned no site
// of the list above it: universities, for their law schools, which is all of
// "edu" and its like in other countries, sites that republish codes, and
// the bodies of the profession. Still left out are the sites of law firms,
// which are most of what a search returns, and are written to win clients.
const REFERENCE_DOMAINS = [
  // Republishers of statutes and opinions
  "courtlistener.com",
  "justia.com",
  "findlaw.com",
  "public.law",
  "canlii.org",
  "bailii.org",
  "austlii.edu.au",
  "nzlii.org",
  // Universities, which covers cornell.edu
  "edu",
  "ac.uk",
  "edu.au",
  "ac.nz",
  // Bodies of the profession
  "americanbar.org",
  "lawsociety.org.uk",
  "barcouncil.org.uk",
];

function isOn(domain: string, list: string[]): boolean {
  return list.some((entry) => domain === entry || domain.endsWith(`.${entry}`));
}

/** Returns what kind of source of law a website is, by its domain */
export function getSourceKind(domain: string | undefined): SourceKind {
  const name = (domain ?? "")
    .trim()
    .toLowerCase()
    .replace(/^www\./, "");
  // NOTE: only a plain host name. Anything else is not a domain that the
  // search gave, and must not match by its end.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name)) {
    return "other";
  }
  if (isOn(name, PRIMARY_DOMAINS) || US_STATE_DOMAIN.test(name)) {
    return "primary";
  }
  return isOn(name, REFERENCE_DOMAINS) ? "reference" : "other";
}

/** Whether a reason in a tree may cite a source of this kind */
export function isCitable(kind: SourceKind): boolean {
  return kind !== "other";
}
