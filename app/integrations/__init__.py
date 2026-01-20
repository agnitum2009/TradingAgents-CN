"""
TACN v2.0 - Integrations Module

Provides bridges to TypeScript and Rust services from Python.
"""

from .typescript_bridge import TypeScriptServiceBridge, get_ts_bridge, initialize_ts_bridge

__all__ = [
    "TypeScriptServiceBridge",
    "get_ts_bridge",
    "initialize_ts_bridge",
]
