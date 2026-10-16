# Book providers

`OpenLibrary` is the server-side adapter for the Open Library Search API. It sets an application User-Agent, requests only the fields Scripd consumes, bounds response size, applies a request timeout and caps concurrent calls. Provider keys and cover URLs are normalized before they reach persistence.
