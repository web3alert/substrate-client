type Details = Record<string, unknown>;

export class ErrorDetails extends Error {
  public details?: Details;
  
  constructor(message?: string, details?: Details) {
    super(message);
    
    this.details = details;
  }
}

export function isErrorDetails(err: any): err is ErrorDetails {
  return err instanceof ErrorDetails;
}

export function error(message: string, details?: Details): ErrorDetails {
  return new ErrorDetails(message, details);
}
