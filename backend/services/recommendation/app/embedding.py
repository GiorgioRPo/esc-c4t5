"""Sentence Transformer embedding provider.

The model is loaded ONCE at application startup and reused for every request.
Loading per-request would add seconds of latency and blow up memory.
"""

import logging
from typing import Protocol

import numpy as np
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


class EmbeddingProvider(Protocol):
    @property
    def model_name(self) -> str: ...
    @property
    def dimension(self) -> int: ...
    def embed_documents(self, texts: list[str]) -> np.ndarray: ...
    def embed_query(self, text: str) -> np.ndarray: ...


class SentenceTransformerEmbeddingProvider:
    def __init__(self, model_name: str, expected_dimension: int) -> None:
        logger.info("loading embedding model %s", model_name)
        self._model = SentenceTransformer(model_name)
        self._model_name = model_name

        actual = self._model.get_sentence_embedding_dimension()
        if actual != expected_dimension:
            raise ValueError(
                f"{model_name} produces {actual}-dim embeddings but config "
                f"expects {expected_dimension}. Update EMBEDDING_DIMENSION and "
                f"the vector(N) column together, then re-embed everything."
            )
        self._dimension = actual

    @property
    def model_name(self) -> str:
        return self._model_name

    @property
    def dimension(self) -> int:
        return self._dimension

    def _encode(self, texts: list[str], *, is_query: bool) -> np.ndarray:
        """Uses encode_query/encode_document when available (sentence-transformers
        >= 5), falling back to plain encode() on older versions. Query and
        document intent stays explicit either way."""
        method_name = "encode_query" if is_query else "encode_document"
        method = getattr(self._model, method_name, None)

        if callable(method):
            vectors = method(texts, normalize_embeddings=True)
        else:
            vectors = self._model.encode(texts, normalize_embeddings=True)

        array = np.asarray(vectors, dtype=np.float32)
        if array.ndim == 1:
            array = array.reshape(1, -1)
        if array.shape[1] != self._dimension:
            raise ValueError(
                f"expected {self._dimension}-dim embeddings, got {array.shape[1]}"
            )
        return array

    def embed_documents(self, texts: list[str]) -> np.ndarray:
        return self._encode(texts, is_query=False)

    def embed_query(self, text: str) -> np.ndarray:
        return self._encode([text], is_query=True)[0]

    def warm(self) -> None:
        """Forces lazy tensor allocation so the first real request isn't slow."""
        self.embed_query("warmup")
