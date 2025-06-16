class ApiResponse {
    constructor(data = {}, statuscode, message = "success") {
      this.data = data;
      this.statuscode = statuscode;
      this.message = message;
      this.success = statuscode < 400;
    }
  }
  
  export default ApiResponse;