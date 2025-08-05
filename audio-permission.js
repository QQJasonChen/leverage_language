// Audio permission request script
const button = document.getElementById('requestPermission');
const status = document.getElementById('status');

function showStatus(message, type) {
  status.textContent = message;
  status.className = `status ${type}`;
  status.style.display = 'block';
}

async function requestMicrophonePermission() {
  button.disabled = true;
  showStatus('Requesting microphone permission...', 'info');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Permission granted - stop the stream
    stream.getTracks().forEach(track => track.stop());
    
    showStatus('✅ Microphone permission granted! You can now close this tab and use voice search.', 'success');
    
    // Store permission status
    if (chrome.storage) {
      await chrome.storage.local.set({ microphonePermissionGranted: true });
    }
    
    // Close the tab after a delay
    setTimeout(() => {
      window.close();
    }, 3000);
    
  } catch (error) {
    console.error('Microphone permission error:', error);
    
    if (error.name === 'NotAllowedError') {
      showStatus('❌ Microphone permission denied. Please check your browser settings and try again.', 'error');
    } else if (error.name === 'NotFoundError') {
      showStatus('❌ No microphone found. Please connect a microphone and try again.', 'error');
    } else {
      showStatus('❌ Error accessing microphone: ' + error.message, 'error');
    }
    
    button.disabled = false;
  }
}

button.addEventListener('click', requestMicrophonePermission);

// Auto-request on page load
requestMicrophonePermission();