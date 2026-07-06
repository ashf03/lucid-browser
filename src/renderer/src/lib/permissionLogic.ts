export interface PermissionRequest {
  id: number;
  permission: string;
  displayName: string;
  description: string;
  icon: string;
  origin: string;
  details: any;
}

export interface HistoryItem {
  permission: string;
  origin: string;
  granted: boolean | null;
  timestamp: string;
}

// Get permission details based on type
export const getPermissionDetails = (request: PermissionRequest): string[] => {
  const details: string[] = [];
  
  switch (request.permission) {
    case 'camera':
      details.push('Access to camera feed');
      details.push('May record video');
      details.push('Camera light will be on when active');
      break;
    case 'microphone':
      details.push('Access to microphone input');
      details.push('May record audio');
      details.push('Can listen to conversations');
      break;
    case 'display-capture':
      details.push('View and record screen content');
      details.push('Access to all visible information');
      details.push('May capture sensitive data');
      details.push('Can see other applications');
      details.push('Recording may continue in background');
      if (request.details?.audio) {
        details.push('Audio from system will be included');
      }
      if (request.details?.video) {
        details.push('Video of entire screen will be captured');
      }
      break;
    case 'geolocation':
      details.push('Your precise location');
      details.push('May track your movements');
      details.push('Location history may be stored');
      break;
    case 'notifications':
      details.push('Show desktop notifications');
      details.push('May display even when tab is closed');
      details.push('Can interrupt your work');
      break;
    case 'clipboard-read':
      details.push('Read clipboard contents');
      details.push('Access to copied text/images');
      details.push('May access sensitive information');
      break;
    case 'clipboard-write':
      details.push('Write to clipboard');
      details.push('Replace current clipboard content');
      details.push('Can overwrite your copied data');
      break;
    case 'midi':
      details.push('Access MIDI devices');
      details.push('Control musical instruments');
      details.push('May access connected hardware');
      break;
    case 'usb':
      details.push('Access USB devices');
      details.push('Communicate with hardware');
      details.push('May access connected peripherals');
      break;
    case 'bluetooth':
      details.push('Access Bluetooth devices');
      details.push('Connect to wireless devices');
      details.push('May access paired devices');
      break;
    default:
      details.push(`Grant ${request.permission} permission`);
      details.push('May access system resources');
      details.push('Review carefully before allowing');
  }

  return details;
};

// Send response to main process
export const sendPermissionResponse = (request: PermissionRequest, granted: boolean): boolean => {
  if (!request) {
    console.error('❌ No current request to respond to');
    return false;
  }

  console.log(`📤 Sending permission response: ${granted} for request ${request.id}`);

  try {
    window.electronAPI.permissions.sendResponse({
      id: request.id,
      granted
    });
    console.log('✅ Permission response sent successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to send permission response:', error);
    return false;
  }
};

// Create history item from request and response
export const createHistoryItem = (request: PermissionRequest, granted: boolean): HistoryItem => ({
  permission: request.displayName || request.permission,
  origin: request.origin,
  granted,
  timestamp: new Date().toLocaleString()
});