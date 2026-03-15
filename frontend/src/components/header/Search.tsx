"use client";

import { useRef, useState, useEffect } from "react";
import { SparklesIcon } from '@heroicons/react/24/outline'
import { useRouter } from "next/navigation";
import { Entity } from "@/api/models/Entity";
import { SearchService } from "@/api/services/SearchService";

type SearchMode = "text" | "semantic";

export function Search() {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Entity[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>("text");
  const [pendingSemanticSearch, setPendingSemanticSearch] = useState(false);
  const router = useRouter();

  // Perform search
  const performSearch = async (searchQuery: string, mode: SearchMode) => {
    try {
      setLoading(true);
      const data = mode === "semantic"
        ? await SearchService.findEntitiesSemanticFindSemanticGet(searchQuery)
        : await SearchService.findEntitiesFindGet(searchQuery);
      setResults(data.entities ?? []);
      setShowDropdown(true);
    } catch (err) {
      console.error("Search failed", err);
      setResults([]);
      setShowDropdown(true);
    } finally {
      setLoading(false);
      setPendingSemanticSearch(false);
    }
  };

  // Debounce search for text mode only. When semantic mode is active show a hint
  // dropdown instructing the user to press Enter to run the AI search.
  useEffect(() => {
    // If semantic (AI) mode is enabled, show the hint dropdown immediately.
    if (searchMode === "semantic") {
      setPendingSemanticSearch(true);
      setShowDropdown(true);
      // Don't perform automatic searches in semantic mode; wait for Enter.
      return;
    }

    // Text mode: require a minimum query length before searching.
    if (query.length < 3) {
      setResults([]);
      setShowDropdown(false);
      setPendingSemanticSearch(false);
      return;
    }

    // For text search, debounce and auto-search
    const delay = setTimeout(async () => {
      await performSearch(query, "text");
    }, 300);

    return () => clearTimeout(delay);
  }, [query, searchMode]);

  // Hide on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleRowClick = (api: string, rowId: string) => {
    router.push(`/${api}?id=${rowId}`);
    setShowDropdown(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchMode === "semantic" && query.length >= 3) {
      e.preventDefault();
      performSearch(query, "semantic");
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (searchMode === "semantic" && query.length >= 3) {
            performSearch(query, "semantic");
          }
        }}
      >
        <div className="relative">
          <span className="absolute -translate-y-1/2 left-4 top-1/2 pointer-events-none">
            <svg
              className="fill-gray-500 dark:fill-gray-400"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
                fill=""
              />
            </svg>
          </span>
            <input
            ref={inputRef}
            type="text"
            data-testid="search-input"
            placeholder={searchMode === "semantic" ? "AI Search..." : "Search..."}
            className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-[60px] text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 xl:w-[500px]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true);
            }}
          />

          {/* Search Mode Toggle */}
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-end gap-2 w-[60px]">
            <button
              type="button"
              title="AI Search"
              aria-label="AI Search"
              aria-pressed={searchMode === "semantic"}
              onClick={() => {
                const nextMode: SearchMode = searchMode === "text" ? "semantic" : "text";
                const isGenericToAi = searchMode === "text" && nextMode === "semantic";

                setSearchMode(nextMode);

                // new behavior should be applied only on generic - ai transition
                if (isGenericToAi && query.length >= 3) {
                  performSearch(query, "semantic");
                }
              }}
        className={`inline-flex items-center justify-center h-8 w-8 rounded-md text-sm transition-colors duration-150 focus:outline-none focus:ring-0 focus-visible:ring-0 active:outline-none active:ring-0 border-0 shadow-none ${
                searchMode === "semantic"
          ? "bg-brand-500 text-white hover:bg-brand-600 focus:ring-2 focus:ring-brand-500/20"
          : "bg-transparent text-gray-500 dark:text-gray-400"
              }`}
            >
        <SparklesIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </form>

      {showDropdown && (
        <div className="absolute mt-1 w-full rounded-lg border border-gray-200 bg-white dark:bg-gray-900 shadow-lg z-50">
          {loading ? (
            <div className="p-3 text-sm text-gray-500">
              {searchMode === "semantic" ? "Generating embeddings and searching..." : "Loading..."}
            </div>
          ) : pendingSemanticSearch ? (
            <div className="p-3 text-sm text-gray-500">
              Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 rounded">Enter</kbd> to search with AI
            </div>
          ) : results.length > 0 ? (
            <ul className="max-h-80 overflow-auto">
              {results.map((entity) => (
                <li
                  key={entity.id}
                  className="cursor-pointer px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                  onClick={() => handleRowClick(entity.api, entity.id)}
                >
                  <div className="text-sm text-gray-900 dark:text-white">
                    {entity.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {entity.api}
                    {searchMode === "semantic" && <span className="ml-2 text-brand-500">• Semantic</span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-sm text-gray-500">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}