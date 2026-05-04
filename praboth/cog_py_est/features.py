"""Legacy shim for feature extraction."""

from backend.src.services.processing.features import FEATURE_VECTOR_DIM, FeatureWindow, fuse_features

__all__ = ["FEATURE_VECTOR_DIM", "FeatureWindow", "fuse_features"]
