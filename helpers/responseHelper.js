const sendResponse = (res, code, status, message, data = null) => {
    res.status(code).json({
      code,
      status,
      message,
      data,
    });
  };
  
  module.exports = sendResponse;