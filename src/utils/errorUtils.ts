export const getErrorMessage = (err: any): { title: string, description?: string } => {
  if (typeof err === 'string') {
    return { title: err };
  }

  const message = err?.message || String(err);

  // Try to parse JSON error from Firestore
  try {
    const parsed = JSON.parse(message);
    if (parsed.error) {
      const op = parsed.operationType ? ` during ${parsed.operationType}` : '';
      const path = parsed.path ? ` at ${parsed.path}` : '';
      
      if (parsed.error.includes('permission-denied')) {
        return {
          title: "Access Denied",
          description: `Neural permissions insufficient${op}${path}. Please verify your clearance.`
        };
      }
      if (parsed.error.includes('quota-exceeded')) {
        return {
          title: "Quota Exceeded",
          description: "Neural link bandwidth exhausted. Please wait for synchronization reset."
        };
      }
      if (parsed.error.includes('offline')) {
        return {
          title: "Link Severed",
          description: "Neural connection lost. Please check your local uplink."
        };
      }
      return {
        title: "Firestore Error",
        description: `${parsed.error}${op}${path}`
      };
    }
  } catch {
    // Not JSON, continue with standard checks
  }

  if (message.includes('permission-denied')) {
    return {
      title: "Access Denied",
      description: "Neural permissions insufficient. Please verify your clearance."
    };
  }

  if (message.includes('network error') || message.includes('failed to fetch') || message.includes('timeout')) {
    return {
      title: "Connection Failure",
      description: "The neural uplink is unstable. Please check your network connection."
    };
  }

  if (message.includes('API_KEY_INVALID')) {
    return {
      title: "Authentication Error",
      description: "The neural key is invalid. Please re-authenticate."
    };
  }

  if (message.toLowerCase().includes('validation failed') || message.toLowerCase().includes('invalid data')) {
    return {
      title: "Data Corruption",
      description: "The provided neural pattern is malformed or invalid."
    };
  }

  if (message.includes('not found')) {
    return {
      title: "Pattern Not Found",
      description: "The requested neural memory could not be located in the timeline."
    };
  }

  return {
    title: "System Interruption",
    description: message
  };
};
