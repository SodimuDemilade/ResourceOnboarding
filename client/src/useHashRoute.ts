import { useEffect, useState } from "react";

export type Route =
  | { page: "new" }
  | { page: "cases" }
  | { page: "case"; id: string };

/** "#/cases/abc" → { page: "case", id: "abc" }. Anything unknown → the new-case form. */
function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  if (parts[0] === "cases" && parts[1])
    return { page: "case", id: decodeURIComponent(parts[1]) };
  if (parts[0] === "cases") return { page: "cases" };
  return { page: "new" };
}

export function hrefFor(route: Route): string {
  if (route.page === "case") return `#/cases/${encodeURIComponent(route.id)}`;
  if (route.page === "cases") return "#/cases";
  return "#/new";
}

/** The current page, read from the URL hash. It survives a refresh, and Back/Forward work. */
export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  // Changing the hash adds a history entry and fires "hashchange", which updates the state above
  const navigate = (next: Route) => {
    window.location.hash = hrefFor(next);
  };
  return [route, navigate];
}
