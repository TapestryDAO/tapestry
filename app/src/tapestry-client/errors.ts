/** Base class for errors */
export abstract class TapestryError extends Error {
    constructor(message?: string) {
        super(message);
    }
}

/** Thrown if failed to parse the instruction */
export class TokenAccountNotFoundError extends TapestryError {
    name = 'InvalidInstruction';
};

/** Thrown if an account was not rent exempt */
export class NotRentExempt extends TapestryError {
    name = 'NotRentExempt';
};

/** Thrown if an account had the wrong owner */
export class TokenInvalidAccountSizeError extends TapestryError {
    name = 'IncorrectOwner';
};

/** Thrown if the tapestry state PDA account passed was incorrect */
export class InvalidTapestryStatePDA extends TapestryError {
    name = 'InvalidTapestryStatePDA';
};