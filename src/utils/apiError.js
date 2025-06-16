class ApiError extends Error {
    constructor(statuscode, message = "error message", error = [], stack = "") {
      super(message);
      (this.statuscode = statuscode),
        (this.error = error),
        (this.success = false);
  
      if (stack) {
        this.stack = stack;
      } else {
        Error.captureStackTrace(this, this.constructor);
      }
    }
  }
  //
  
  export default ApiError;