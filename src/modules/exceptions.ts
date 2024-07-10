export class ApplicationError implements Error {
    public name = 'ApplicationError';

    constructor(public message: string) {
    }

    toString() {
        return this.name + ': ' + this.message;
    }
}

export class FileNotFoundError extends ApplicationError {
    public name = 'FileNotFoundError';
}

export class DirectoryNotFoundError extends ApplicationError {
    public name = 'DirectoryNotFoundError';
}

export class InvalidJsonException extends ApplicationError {
    public name = 'InvalidJsonException';
}

