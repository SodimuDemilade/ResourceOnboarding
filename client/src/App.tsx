import { CasePage } from "./pages/CasePage";
import { CasesPage } from "./pages/CasesPage";
import { NewCasePage } from "./pages/NewCasePage";
import { hrefFor, useHashRoute } from "./useHashRoute";

export function App() {
  const [route, navigate] = useHashRoute();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a href={hrefFor({ page: "new" })} className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <circle cx="12" cy="5" r="2.5" />
                <circle cx="5" cy="18" r="2.5" />
                <circle cx="19" cy="18" r="2.5" />
                <path d="M12 7.5v4M12 11.5L6.5 16M12 11.5l5.5 4.5" />
              </svg>
            </span>
            Onboarding Agents
          </a>
          <nav className="nav">
            <a
              href={hrefFor({ page: "new" })}
              aria-current={route.page === "new" ? "page" : undefined}
            >
              New onboarding
            </a>
            <a
              href={hrefFor({ page: "cases" })}
              aria-current={route.page !== "new" ? "page" : undefined}
            >
              Cases
            </a>
          </nav>
        </div>
      </header>
      <main className="container">
        {route.page === "new" && (
          <NewCasePage onCreated={(id) => navigate({ page: "case", id })} />
        )}
        {route.page === "cases" && <CasesPage />}
        {route.page === "case" && <CasePage key={route.id} id={route.id} />}
      </main>
    </>
  );
}
