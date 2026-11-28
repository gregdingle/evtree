/// <reference types="jest" />
import { getSourceKind, isCitable } from "./legal-sources";

describe("getSourceKind", () => {
  test.each([
    "supremecourt.gov",
    "www.courts.ca.gov",
    "leginfo.legislature.ca.gov",
    "legislation.gov.uk",
    "www.judiciary.uk",
    "laws-lois.justice.gc.ca",
    "eur-lex.europa.eu",
    "courts.state.ny.us",
    "Legislation.GOV.AU",
  ])("should take %s for a court, a legislature or a government", (domain) => {
    expect(getSourceKind(domain)).toBe("primary");
    expect(isCitable(getSourceKind(domain))).toBe(true);
  });

  test.each([
    // NOTE: the search gives a domain without its subdomain
    "cornell.edu",
    "law.cornell.edu",
    "www.law.cornell.edu",
    "justia.com",
    "law.justia.com",
    "findlaw.com",
    "public.law",
    "california.public.law",
    "famu.edu",
    "law.ox.ac.uk",
    "americanbar.org",
    "courtlistener.com",
    "canlii.org",
    "bailii.org",
    "austlii.edu.au",
  ])("should take %s for a legal reference", (domain) => {
    expect(getSourceKind(domain)).toBe("reference");
    expect(isCitable(getSourceKind(domain))).toBe(true);
  });

  test.each([
    "ezel.ai",
    "varsitytutors.com",
    "thomsonreuters.com",
    "go-legal.co.uk",
    "google.com",
    "scholar.google.com",
    "wikipedia.org",
    "bonalaw.com",
    "pinsentmasons.com",
    "lawteacher.net",
    "nycbar.org",
  ])("should take %s for another page", (domain) => {
    expect(getSourceKind(domain)).toBe("other");
    expect(isCitable(getSourceKind(domain))).toBe(false);
  });

  test.each([
    // A name that only starts like a source of law
    "gov.example.com",
    "justia.com.evil.io",
    "law.cornell.edu.example.org",
    "notjustia.com",
    "fakegov",
    "state.ny.us.example.com",
    "edu.example.com",
    "harvard.edu.evil.io",
    "notpublic.law",
    // Not a domain
    "",
    undefined,
    "gov",
    "https://supremecourt.gov",
    "supremecourt.gov/opinions",
    "evil.com?x=.gov",
    "evil.com#.gov",
    "evil.com .gov",
  ])("should not take the look-alike %s for a source of law", (domain) => {
    expect(getSourceKind(domain)).toBe("other");
  });
});
