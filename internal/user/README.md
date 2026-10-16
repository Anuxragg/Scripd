User and profile module boundary. Profile reads and writes belong in services; repositories expose persistence operations without HTTP or SQL concerns leaking upward.
