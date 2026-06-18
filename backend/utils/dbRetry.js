/**
 * Utility functions for database retry logic and connection management
 * Helps handle connection timeouts and temporary network issues
 */

/**
 * Execute a database operation with automatic retry on connection failures
 * @param {Function} operation - The async database operation to execute
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelay - Base delay in ms between retries (default: 1000)
 * @param {boolean} options.exponentialBackoff - Use exponential backoff (default: true)
 * @param {Array} options.retryableErrors - Array of error patterns to retry on
 * @returns {Promise} Result of the operation
 */
export const executeWithRetry = async (operation, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    exponentialBackoff = true,
    retryableErrors = [
      /ConnectionError/,
      /ConnectionRefusedError/,
      /ConnectionTimedOutError/,
      /TimeoutError/,
      /SequelizeConnectionError/,
      /ETIMEDOUT/,
      /ECONNRESET/,
      /ENOTFOUND/,
      /ENETUNREACH/,
      /ECONNREFUSED/,
      /Connection terminated/,
      /connection timeout/
    ]
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`DB Operation - Attempt ${attempt + 1}/${maxRetries + 1}`);
      const result = await operation();
      
      if (attempt > 0) {
        console.log(`DB Operation - Success after ${attempt + 1} attempts`);
      }
      
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if this is a retryable error
      const isRetryable = retryableErrors.some(pattern => {
        if (pattern instanceof RegExp) {
          return pattern.test(error.message) || 
                 pattern.test(error.name) || 
                 pattern.test(error.code);
        }
        return error.message.includes(pattern) || 
               error.name.includes(pattern) || 
               error.code === pattern;
      });
      
      if (!isRetryable || attempt === maxRetries) {
        console.error(`DB Operation - Failed after ${attempt + 1} attempts:`, error.message);
        throw error;
      }
      
      // Calculate delay for next retry
      const delay = exponentialBackoff 
        ? baseDelay * Math.pow(2, attempt)
        : baseDelay;
      
      console.warn(`DB Operation - Attempt ${attempt + 1} failed (${error.message}), retrying in ${delay}ms...`);
      
      // Wait before next retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

/**
 * Wrap a Sequelize operation with retry logic
 * @param {Function} sequelizeOperation - The Sequelize operation to wrap
 * @param {Object} retryOptions - Options for retry behavior
 * @returns {Function} Wrapped operation with retry logic
 */
export const withDatabaseRetry = (sequelizeOperation, retryOptions = {}) => {
  return async (...args) => {
    return executeWithRetry(() => sequelizeOperation(...args), retryOptions);
  };
};

/**
 * Test database connectivity with retry
 * @param {Sequelize} sequelize - Sequelize instance to test
 * @param {Object} options - Test options
 * @returns {Promise<boolean>} True if connection successful
 */
export const testDatabaseConnection = async (sequelize, options = {}) => {
  const { maxRetries = 3, timeout = 10000 } = options;
  
  return executeWithRetry(
    async () => {
      await Promise.race([
        sequelize.authenticate(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection test timeout')), timeout)
        )
      ]);
      return true;
    },
    { maxRetries }
  );
};

/**
 * Enhanced transaction wrapper with retry logic
 * @param {Sequelize} sequelize - Sequelize instance
 * @param {Function} transactionCallback - Function to execute within transaction
 * @param {Object} options - Transaction and retry options
 * @returns {Promise} Transaction result
 */
export const transactionWithRetry = async (sequelize, transactionCallback, options = {}) => {
  const { maxRetries = 2, isolationLevel, ...transactionOptions } = options;
  
  return executeWithRetry(
    async () => {
      const txOptions = { ...transactionOptions };
      if (isolationLevel) {
        txOptions.isolationLevel = isolationLevel;
      }
      return sequelize.transaction(txOptions, transactionCallback);
    },
    { maxRetries }
  );
};

/**
 * Monitor database connection health
 * @param {Sequelize} sequelize - Sequelize instance to monitor
 * @param {Object} options - Monitoring options
 * @returns {Object} Health check result
 */
export const checkDatabaseHealth = async (sequelize, options = {}) => {
  const { includeStats = false } = options;
  
  try {
    const startTime = Date.now();
    await sequelize.authenticate();
    const responseTime = Date.now() - startTime;
    
    const result = {
      status: 'healthy',
      responseTime,
      timestamp: new Date().toISOString()
    };
    
    if (includeStats) {
      const pool = sequelize.connectionManager.pool;
      result.pool = {
        used: pool.used,
        waiting: pool.pending,
        available: pool.available,
        max: pool.max,
        min: pool.min
      };
    }
    
    return result;
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};