// Remembers, per route, the query string that describes what the page is
// currently showing. The page writes its parameters into the URL itself
// (useExperimentUrl); any other change of query — a preset link, the Back
// button, an edited address — is an external navigation, and the page is
// remounted so it starts from the new URL (see ExperimentRoute).

const shown = new Map();

export const rememberShownSearch = (pathname, search) => shown.set(pathname, search);

export const isShownSearch = (pathname, search) => shown.get(pathname) === search;
