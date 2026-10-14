/**
 * Shared error taxonomy (B0-09). Services throw these; thin wrappers map them
 * to HTTP status codes or form errors. NotFound and Forbidden share the same
 * default public message so callers cannot tell whether a record exists.
 */

const HIDDEN_RECORD_MESSAGE = "Not found";

export class Unauthenticated extends Error {
  readonly code = "Unauthenticated" as const;

  constructor(message = "Unauthenticated") {
    super(message);
    this.name = "Unauthenticated";
  }
}

export class Forbidden extends Error {
  readonly code = "Forbidden" as const;

  constructor(message = HIDDEN_RECORD_MESSAGE) {
    super(message);
    this.name = "Forbidden";
  }
}

export class NotFound extends Error {
  readonly code = "NotFound" as const;

  constructor(message = HIDDEN_RECORD_MESSAGE) {
    super(message);
    this.name = "NotFound";
  }
}

export class Validation extends Error {
  readonly code = "Validation" as const;

  constructor(message = "Validation failed") {
    super(message);
    this.name = "Validation";
  }
}

export class Conflict extends Error {
  readonly code = "Conflict" as const;

  constructor(message = "Conflict") {
    super(message);
    this.name = "Conflict";
  }
}

export class RateLimited extends Error {
  readonly code = "RateLimited" as const;

  constructor(message = "Too many requests") {
    super(message);
    this.name = "RateLimited";
  }
}

export class Internal extends Error {
  readonly code = "Internal" as const;

  constructor(message = "Internal error") {
    super(message);
    this.name = "Internal";
  }
}

export type AppError =
  Unauthenticated | Forbidden | NotFound | Validation | Conflict | RateLimited | Internal;
