/** Ported from the SMSF platform's lib/microsoft-graph/errors.ts. */

class MicrosoftGraphError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MicrosoftGraphError';
  }
}

/** Token acquisition failed — credentials wrong, or consent not granted. */
class MicrosoftGraphAuthError extends MicrosoftGraphError {
  constructor(message) {
    super(message);
    this.name = 'MicrosoftGraphAuthError';
  }
}

/** The integration simply isn't set up yet. Not an error condition to alarm on. */
class MicrosoftGraphConfigError extends MicrosoftGraphError {
  constructor(message) {
    super(message);
    this.name = 'MicrosoftGraphConfigError';
  }
}

const isGraphError = (e) => e instanceof MicrosoftGraphError;
const isConfigError = (e) => e instanceof MicrosoftGraphConfigError;
const isAuthError = (e) => e instanceof MicrosoftGraphAuthError;

module.exports = {
  MicrosoftGraphError,
  MicrosoftGraphAuthError,
  MicrosoftGraphConfigError,
  isGraphError,
  isConfigError,
  isAuthError,
};
