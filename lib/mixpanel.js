import mixpanel from 'mixpanel-browser';

// Initialize Mixpanel only on client-side
let isInitialized = false;

export const initMixpanel = () => {
  if (typeof window === 'undefined') return;
  
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  
  if (!token) {
    return;
  }
  
  if (!isInitialized) {
    mixpanel.init(token, {
      debug: process.env.NODE_ENV === 'development',
      track_pageview: true,
      persistence: 'localStorage',
      ignore_dnt: false,
    });
    isInitialized = true;
  }
};

// Track events safely (no-op if not initialized)
export const track = (event, properties = {}) => {
  if (typeof window === 'undefined') return;
  
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token || !isInitialized) return;
  
  try {
    mixpanel.track(event, {
      ...properties,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Silent fail
  }
};

// Track page views
export const trackPageView = (pageName) => {
  track('Page View', { page: pageName });
};

// Track voice selection
export const trackVoiceSelect = (voiceName, voiceGender, voiceLang) => {
  track('Voice Selected', { 
    voice_name: voiceName,
    voice_gender: voiceGender,
    voice_lang: voiceLang,
  });
};

// Track style preset selection
export const trackStyleSelect = (styleName, isCustom) => {
  track('Style Selected', { 
    style_name: styleName,
    is_custom: isCustom,
  });
};

// Track generation start
export const trackGenerationStart = (wordCount, charCount, chunkCount, voiceName, styleName, textContent) => {
  track('Generation Started', {
    word_count: wordCount,
    char_count: charCount,
    chunk_count: chunkCount,
    voice_name: voiceName,
    style_name: styleName,
    text_content: textContent || '',
  });
};

// Track generation success
export const trackGenerationSuccess = (wordCount, charCount, chunkCount, durationSeconds, voiceName, styleName) => {
  track('Generation Success', {
    word_count: wordCount,
    char_count: charCount,
    chunk_count: chunkCount,
    duration_seconds: durationSeconds,
    voice_name: voiceName,
    style_name: styleName,
  });
};

// Track generation error
export const trackGenerationError = (errorMessage, wordCount, chunkCount, voiceName) => {
  track('Generation Error', {
    error_message: errorMessage,
    word_count: wordCount,
    chunk_count: chunkCount,
    voice_name: voiceName,
  });
};

// Track download
export const trackDownload = (voiceName, styleName, wordCount) => {
  track('Audio Downloaded', {
    voice_name: voiceName,
    style_name: styleName,
    word_count: wordCount,
  });
};

// Track voice preview
export const trackVoicePreview = (voiceName) => {
  track('Voice Preview', { voice_name: voiceName });
};

// Track buy me a chai click
export const trackSupportClick = () => {
  track('Support Button Clicked', { button: 'Buy me a chai' });
};

// Track API error
export const trackAPIError = (endpoint, errorMessage, statusCode) => {
  track('API Error', {
    endpoint: endpoint,
    error_message: errorMessage,
    status_code: statusCode,
  });
};

// Track File Upload (for subtitles)
export const trackFileUpload = (fileType, fileSize) => {
  track('File Uploaded', {
    file_type: fileType,
    file_size: fileSize,
  });
};

// Track Transcription Start
export const trackTranscriptionStart = (fileType, fileSize) => {
  track('Transcription Started', {
    file_type: fileType,
    file_size_mb: Math.round(fileSize / 1024 / 1024 * 100) / 100,
  });
};

// Track Transcription Success
export const trackTranscriptionSuccess = (durationSeconds, wordCount) => {
  track('Transcription Success', {
    duration_seconds: durationSeconds,
    word_count: wordCount,
  });
};

// Track General Click (Buttons, Links)
export const trackClick = (elementName, targetUrl = null) => {
  track('Click Event', {
    element_name: elementName,
    target_url: targetUrl,
  });
};
