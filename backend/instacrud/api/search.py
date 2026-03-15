# instacrud/api/search.py
import re
from typing import List, Iterable, Set
from pydantic import Field

# ============================
# Searchable Mixin
# ============================
class SearchableMixin:
    search_tokens: List[str] = Field(default_factory=list)

# ============================
# Token generation logic
# ============================
_word_re = re.compile(r"[a-z0-9]+")

# These values define search index semantics.
# Changing them affects data shape and requires re-indexing.
MIN_PREFIX_LEN = 2
MAX_PREFIX_LEN = 10
MAX_TOKENS = 50

def _normalize(text: str) -> str:
    return text.lower().strip()

def _extract_words(text: str) -> list[str]:
    return _word_re.findall(text)

def _prefixes(word: str) -> Iterable[str]:
    for i in range(MIN_PREFIX_LEN, min(len(word), MAX_PREFIX_LEN) + 1):
        yield word[:i]

def build_search_tokens(*values: str | None) -> list[str]:
    tokens: Set[str] = set()

    for value in values:
        if not value:
            continue

        norm = _normalize(value)
        for word in _extract_words(norm):
            tokens.add(word)
            tokens.update(_prefixes(word))

        if len(tokens) >= MAX_TOKENS:
            break

    return sorted(tokens)[:MAX_TOKENS]
