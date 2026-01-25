import { v4 } from 'uuid';
import escape from 'xml-escape';
import WebSocket2 from 'isomorphic-ws';
import { createHash } from 'crypto';
import axios, { AxiosError } from 'axios';

// src/utils.ts

// src/exceptions.ts
export var EdgeTTSException = class extends Error {
  constructor(message) {
    super(message);
    this.name = "EdgeTTSException";
  }
};
export var SkewAdjustmentError = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "SkewAdjustmentError";
  }
};
export var UnknownResponse = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "UnknownResponse";
  }
};
export var UnexpectedResponse = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "UnexpectedResponse";
  }
};
export var NoAudioReceived = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "NoAudioReceived";
  }
};
export var WebSocketError = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "WebSocketError";
  }
};
export var ValueError = class extends EdgeTTSException {
  constructor(message) {
    super(message);
    this.name = "ValueError";
  }
};
function getHeadersAndDataFromText(message) {
  const headerLength = message.indexOf("\r\n\r\n");
  const headers = {};
  const headerString = message.subarray(0, headerLength).toString("utf-8");
  if (headerString) {
    const headerLines = headerString.split("\r\n");
    for (const line of headerLines) {
      const [key, value] = line.split(":", 2);
      if (key && value) {
        headers[key] = value.trim();
      }
    }
  }
  return [headers, message.subarray(headerLength + 2)];
}
function getHeadersAndDataFromBinary(message) {
  const headerLength = message.readUInt16BE(0);
  const headers = {};
  const headerString = message.subarray(2, headerLength + 2).toString("utf-8");
  if (headerString) {
    const headerLines = headerString.split("\r\n");
    for (const line of headerLines) {
      const [key, value] = line.split(":", 2);
      if (key && value) {
        headers[key] = value.trim();
      }
    }
  }
  return [headers, message.subarray(headerLength + 2)];
}
function removeIncompatibleCharacters(text) {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " ");
}
function connectId() {
  return v4().replace(/-/g, "");
}
function _findLastNewlineOrSpaceWithinLimit(text, limit) {
  const slice = text.subarray(0, limit);
  let splitAt = slice.lastIndexOf("\n");
  if (splitAt < 0) {
    splitAt = slice.lastIndexOf(" ");
  }
  return splitAt;
}
function _findSafeUtf8SplitPoint(textSegment) {
  let splitAt = textSegment.length;
  while (splitAt > 0) {
    const slice = textSegment.subarray(0, splitAt);
    if (slice.toString("utf-8").endsWith("\uFFFD")) {
      splitAt--;
      continue;
    }
    return splitAt;
  }
  return splitAt;
}
function _adjustSplitPointForXmlEntity(text, splitAt) {
  let ampersandIndex = text.lastIndexOf("&", splitAt - 1);
  while (ampersandIndex !== -1) {
    const semicolonIndex = text.indexOf(";", ampersandIndex);
    if (semicolonIndex !== -1 && semicolonIndex < splitAt) {
      break;
    }
    splitAt = ampersandIndex;
    ampersandIndex = text.lastIndexOf("&", splitAt - 1);
  }
  return splitAt;
}
function* splitTextByByteLength(text, byteLength) {
  let buffer = Buffer.isBuffer(text) ? text : Buffer.from(text, "utf-8");
  while (buffer.length > byteLength) {
    let splitAt = _findLastNewlineOrSpaceWithinLimit(buffer, byteLength);
    if (splitAt < 0) {
      splitAt = _findSafeUtf8SplitPoint(buffer.subarray(0, byteLength));
    }
    splitAt = _adjustSplitPointForXmlEntity(buffer, splitAt);
    if (splitAt <= 0) {
      throw new ValueError(
        "Maximum byte length is too small or invalid text structure near '&' or invalid UTF-8"
      );
    }
    const chunk = buffer.subarray(0, splitAt);
    const chunkString = chunk.toString("utf-8").trim();
    if (chunkString) {
      yield Buffer.from(chunkString, "utf-8");
    }
    buffer = buffer.subarray(splitAt);
  }
  const remainingChunk = buffer.toString("utf-8").trim();
  if (remainingChunk) {
    yield Buffer.from(remainingChunk, "utf-8");
  }
}
function mkssml(tc, escapedText) {
  const text = Buffer.isBuffer(escapedText) ? escapedText.toString("utf-8") : escapedText;
  return `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${tc.voice}'><prosody pitch='${tc.pitch}' rate='${tc.rate}' volume='${tc.volume}'>${text}</prosody></voice></speak>`;
}
function dateToString() {
  return (/* @__PURE__ */ new Date()).toUTCString().replace("GMT", "GMT+0000 (Coordinated Universal Time)");
}
function ssmlHeadersPlusData(requestId, timestamp, ssml) {
  return `X-RequestId:${requestId}\r
Content-Type:application/ssml+xml\r
X-Timestamp:${timestamp}Z\r
Path:ssml\r
\r
${ssml}`;
}
function unescape(text) {
  return text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

// src/tts_config.ts
export var TTSConfig = class _TTSConfig {
  constructor({
    voice,
    rate = "+0%",
    volume = "+0%",
    pitch = "+0Hz"
  }) {
    this.voice = voice;
    this.rate = rate;
    this.volume = volume;
    this.pitch = pitch;
    this.validate();
  }
  validate() {
    const match = /^([a-z]{2,})-([A-Z]{2,})-(.+Neural)$/.exec(this.voice);
    if (match) {
      const [, lang] = match;
      let [, , region, name] = match;
      if (name.includes("-")) {
        const parts = name.split("-");
        region += `-${parts[0]}`;
        name = parts[1];
      }
      this.voice = `Microsoft Server Speech Text to Speech Voice (${lang}-${region}, ${name})`;
    }
    _TTSConfig.validateStringParam(
      "voice",
      this.voice,
      /^Microsoft Server Speech Text to Speech Voice \(.+,.+\)$/
    );
    _TTSConfig.validateStringParam("rate", this.rate, /^[+-]\d+%$/);
    _TTSConfig.validateStringParam("volume", this.volume, /^[+-]\d+%$/);
    _TTSConfig.validateStringParam("pitch", this.pitch, /^[+-]\d+Hz$/);
  }
  static validateStringParam(paramName, paramValue, pattern) {
    if (typeof paramValue !== "string") {
      throw new TypeError(`${paramName} must be a string`);
    }
    if (!pattern.test(paramValue)) {
      throw new ValueError(`Invalid ${paramName} '${paramValue}'.`);
    }
  }
};

// src/constants.ts
export var BASE_URL = "speech.platform.bing.com/consumer/speech/synthesize/readaloud";
export var TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
export var WSS_URL = `wss://${BASE_URL}/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`;
export var VOICE_LIST_URL = `https://${BASE_URL}/voices/list?trustedclienttoken=${TRUSTED_CLIENT_TOKEN}`;
export var DEFAULT_VOICE = "en-US-EmmaMultilingualNeural";
// FIXED VERSION HERE
export var CHROMIUM_FULL_VERSION = "132.0.6834.83"; 
export var CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split(".")[0];
export var SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`;
export var BASE_HEADERS = {
  "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
  "Accept-Encoding": "gzip, deflate, br",
  "Accept-Language": "en-US,en;q=0.9"
};
export var WSS_HEADERS = {
  ...BASE_HEADERS,
  "Pragma": "no-cache",
  "Cache-Control": "no-cache",
  "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold"
};
export var VOICE_HEADERS = {
  ...BASE_HEADERS,
  "Authority": "speech.platform.bing.com",
  "Sec-CH-UA": `" Not;A Brand";v="99", "Microsoft Edge";v="${CHROMIUM_MAJOR_VERSION}", "Chromium";v="${CHROMIUM_MAJOR_VERSION}"`,
  "Sec-CH-UA-Mobile": "?0",
  "Accept": "*/*",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty"
};
export var WIN_EPOCH = 11644473600;
export var S_TO_NS = 1e9;
var _DRM = class _DRM {
  static adjClockSkewSeconds(skewSeconds) {
    _DRM.clockSkewSeconds += skewSeconds;
  }
  static getUnixTimestamp() {
    return Date.now() / 1e3 + _DRM.clockSkewSeconds;
  }
  static parseRfc2616Date(date) {
    try {
      return new Date(date).getTime() / 1e3;
    } catch (e) {
      return null;
    }
  }
  static handleClientResponseError(e) {
    if (!e.response || !e.response.headers) {
      throw new SkewAdjustmentError("No server date in headers.");
    }
    const serverDate = e.response.headers["date"];
    if (!serverDate || typeof serverDate !== "string") {
      throw new SkewAdjustmentError("No server date in headers.");
    }
    const serverDateParsed = _DRM.parseRfc2616Date(serverDate);
    if (serverDateParsed === null) {
      throw new SkewAdjustmentError(`Failed to parse server date: ${serverDate}`);
    }
    const clientDate = _DRM.getUnixTimestamp();
    _DRM.adjClockSkewSeconds(serverDateParsed - clientDate);
  }
  static generateSecMsGec() {
    let ticks = _DRM.getUnixTimestamp();
    ticks += WIN_EPOCH;
    ticks -= ticks % 300;
    ticks *= S_TO_NS / 100;
    const strToHash = `${ticks.toFixed(0)}${TRUSTED_CLIENT_TOKEN}`;
    return createHash("sha256").update(strToHash, "ascii").digest("hex").toUpperCase();
  }
};
_DRM.clockSkewSeconds = 0;
export var DRM = _DRM;
var HttpsProxyAgent;
export var Communicate = class {
  constructor(text, options = {}) {
    this.state = {
      partialText: Buffer.from(""),
      offsetCompensation: 0,
      lastDurationOffset: 0,
      streamWasCalled: false
    };
    this.ttsConfig = new TTSConfig({
      voice: options.voice || DEFAULT_VOICE,
      rate: options.rate,
      volume: options.volume,
      pitch: options.pitch
    });
    if (typeof text !== "string") {
      throw new TypeError("text must be a string");
    }
    this.texts = splitTextByByteLength(
      escape(removeIncompatibleCharacters(text)),
      4096
    );
    this.proxy = options.proxy;
    this.connectionTimeout = options.connectionTimeout;
  }
  parseMetadata(data) {
    const metadata = JSON.parse(data.toString("utf-8"));
    for (const metaObj of metadata["Metadata"]) {
      const metaType = metaObj["Type"];
      if (metaType === "WordBoundary") {
        const currentOffset = metaObj["Data"]["Offset"] + this.state.offsetCompensation;
        const currentDuration = metaObj["Data"]["Duration"];
        return {
          type: metaType,
          offset: currentOffset,
          duration: currentDuration,
          text: unescape(metaObj["Data"]["text"]["Text"])
        };
      }
      if (metaType === "SessionEnd") {
        continue;
      }
      throw new UnknownResponse(`Unknown metadata type: ${metaType}`);
    }
    throw new UnexpectedResponse("No WordBoundary metadata found");
  }
  async *_stream() {
    const url = `${WSS_URL}&Sec-MS-GEC=${DRM.generateSecMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}&ConnectionId=${connectId()}`;
    let agent;
    if (this.proxy) {
      if (!HttpsProxyAgent) {
        try {
          const proxyModule = await import('https-proxy-agent');
          HttpsProxyAgent = proxyModule.HttpsProxyAgent;
        } catch (e) {
          console.warn("https-proxy-agent not available:", e);
        }
      }
      if (HttpsProxyAgent) {
        agent = new HttpsProxyAgent(this.proxy);
      }
    }
    const websocket = new WebSocket2(url, {
      headers: WSS_HEADERS,
      timeout: this.connectionTimeout,
      agent
    });
    const messageQueue = [];
    let resolveMessage = null;
    websocket.on("message", (message, isBinary) => {
      if (!isBinary) {
        const [headers, data] = getHeadersAndDataFromText(message);
        const path = headers["Path"];
        if (path === "audio.metadata") {
          try {
            const parsedMetadata = this.parseMetadata(data);
            this.state.lastDurationOffset = parsedMetadata.offset + parsedMetadata.duration;
            messageQueue.push(parsedMetadata);
          } catch (e) {
            messageQueue.push(e);
          }
        } else if (path === "turn.end") {
          this.state.offsetCompensation = this.state.lastDurationOffset;
          websocket.close();
        } else if (path !== "response" && path !== "turn.start") {
          messageQueue.push(new UnknownResponse(`Unknown path received: ${path}`));
        }
      } else {
        if (message.length < 2) {
          messageQueue.push(new UnexpectedResponse("We received a binary message, but it is missing the header length."));
        } else {
          const headerLength = message.readUInt16BE(0);
          if (headerLength > message.length) {
            messageQueue.push(new UnexpectedResponse("The header length is greater than the length of the data."));
          } else {
            const [headers, data] = getHeadersAndDataFromBinary(message);
            if (headers["Path"] !== "audio") {
              messageQueue.push(new UnexpectedResponse("Received binary message, but the path is not audio."));
            } else {
              const contentType = headers["Content-Type"];
              if (contentType !== "audio/mpeg") {
                if (data.length > 0) {
                  messageQueue.push(new UnexpectedResponse("Received binary message, but with an unexpected Content-Type."));
                }
              } else if (data.length === 0) {
                messageQueue.push(new UnexpectedResponse("Received binary message, but it is missing the audio data."));
              } else {
                messageQueue.push({ type: "audio", data });
              }
            }
          }
        }
      }
      if (resolveMessage) resolveMessage();
    });
    websocket.on("error", (error) => {
      messageQueue.push(new WebSocketError(error.message));
      if (resolveMessage) resolveMessage();
    });
    websocket.on("close", () => {
      messageQueue.push("close");
      if (resolveMessage) resolveMessage();
    });
    await new Promise((resolve) => websocket.on("open", resolve));
    websocket.send(
      `X-Timestamp:${dateToString()}\r
Content-Type:application/json; charset=utf-8\r
Path:speech.config\r
\r
{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r
`
    );
    websocket.send(
      ssmlHeadersPlusData(
        connectId(),
        dateToString(),
        mkssml(this.ttsConfig, this.state.partialText)
      )
    );
    let audioWasReceived = false;
    while (true) {
      if (messageQueue.length > 0) {
        const message = messageQueue.shift();
        if (message === "close") {
          if (!audioWasReceived) {
            throw new NoAudioReceived("No audio was received between connection and close.");
          }
          break;
        } else if (message instanceof Error) {
          throw message;
        } else {
          if (message.type === "audio") audioWasReceived = true;
          yield message;
        }
      } else {
        await new Promise((resolve) => {
          resolveMessage = resolve;
          setTimeout(resolve, 50);
        });
      }
    }
  }
  async *stream() {
    if (this.state.streamWasCalled) {
      throw new Error("stream can only be called once.");
    }
    this.state.streamWasCalled = true;
    for (const partialText of this.texts) {
      this.state.partialText = partialText;
      try {
        for await (const message of this._stream()) {
          yield message;
        }
      } catch (e) {
        if (e instanceof AxiosError && e.response?.status === 403) {
          DRM.handleClientResponseError(e);
          for await (const message of this._stream()) {
            yield message;
          }
        } else {
          throw e;
        }
      }
    }
  }
};

// src/submaker.ts
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1e3);
  const pad = (num, size = 2) => num.toString().padStart(size, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}
export var SubMaker = class {
  constructor() {
    this.cues = [];
  }
  feed(msg) {
    if (msg.type !== "WordBoundary" || msg.offset === void 0 || msg.duration === void 0 || msg.text === void 0) {
      throw new ValueError("Invalid message type, expected 'WordBoundary' with offset, duration and text");
    }
    const start = msg.offset / 1e7;
    const end = (msg.offset + msg.duration) / 1e7;
    this.cues.push({
      index: this.cues.length + 1,
      start,
      end,
      content: msg.text
    });
  }
  mergeCues(words) {
    if (words <= 0) {
      throw new ValueError("Invalid number of words to merge, expected > 0");
    }
    if (this.cues.length === 0) {
      return;
    }
    const newCues = [];
    let currentCue = this.cues[0];
    for (const cue of this.cues.slice(1)) {
      if (currentCue.content.split(" ").length < words) {
        currentCue = {
          ...currentCue,
          end: cue.end,
          content: `${currentCue.content} ${cue.content}`
        };
      } else {
        newCues.push(currentCue);
        currentCue = cue;
      }
    }
    newCues.push(currentCue);
    this.cues = newCues.map((cue, i) => ({ ...cue, index: i + 1 }));
  }
  getSrt() {
    return this.cues.map((cue) => {
      return `${cue.index}\r
${formatTime(cue.start)} --> ${formatTime(cue.end)}\r
${cue.content}\r
`;
    }).join("\r\n");
  }
  toString() {
    return this.getSrt();
  }
};
function buildProxyConfig(proxy) {
  try {
    const proxyUrl = new URL(proxy);
    return {
      host: proxyUrl.hostname,
      port: parseInt(proxyUrl.port),
      protocol: proxyUrl.protocol
    };
  } catch (e) {
    return false;
  }
}
async function _listVoices(proxy) {
  const url = `${VOICE_LIST_URL}&Sec-MS-GEC=${DRM.generateSecMsGec()}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`;
  const response = await axios.get(url, {
    headers: VOICE_HEADERS,
    proxy: proxy ? buildProxyConfig(proxy) : false
  });
  const data = response.data;
  for (const voice of data) {
    voice.VoiceTag.ContentCategories = voice.VoiceTag.ContentCategories.map((c) => c.trim());
    voice.VoiceTag.VoicePersonalities = voice.VoiceTag.VoicePersonalities.map((p) => p.trim());
  }
  return data;
}
async function listVoices(proxy) {
  try {
    return await _listVoices(proxy);
  } catch (e) {
    if (e instanceof AxiosError && e.response?.status === 403) {
      DRM.handleClientResponseError(e);
      return await _listVoices(proxy);
    }
    throw e;
  }
}
export var VoicesManager = class _VoicesManager {
  constructor() {
    this.voices = [];
    this.calledCreate = false;
  }
  static async create(customVoices, proxy) {
    const manager = new _VoicesManager();
    const voices = customVoices ?? await listVoices(proxy);
    manager.voices = voices.map((voice) => ({
      ...voice,
      Language: voice.Locale.split("-")[0]
    }));
    manager.calledCreate = true;
    return manager;
  }
  find(filter) {
    if (!this.calledCreate) {
      throw new Error("VoicesManager.find() called before VoicesManager.create()");
    }
    return this.voices.filter((voice) => {
      return Object.entries(filter).every(([key, value]) => {
        return voice[key] === value;
      });
    });
  }
};

// src/simple.ts
export var EdgeTTS = class {
  constructor(text, voice = "Microsoft Server Speech Text to Speech Voice (zh-CN, XiaoxiaoNeural)", options = {}) {
    this.text = text;
    this.voice = voice;
    this.rate = options.rate || "+0%";
    this.volume = options.volume || "+0%";
    this.pitch = options.pitch || "+0Hz";
  }
  async synthesize() {
    const communicate = new Communicate(this.text, {
      voice: this.voice,
      rate: this.rate,
      volume: this.volume,
      pitch: this.pitch
    });
    const audioChunks = [];
    const wordBoundaries = [];
    for await (const chunk of communicate.stream()) {
      if (chunk.type === "audio" && chunk.data) {
        audioChunks.push(chunk.data);
      } else if (chunk.type === "WordBoundary" && chunk.offset !== void 0 && chunk.duration !== void 0 && chunk.text !== void 0) {
        wordBoundaries.push({
          offset: chunk.offset,
          duration: chunk.duration,
          text: chunk.text
        });
      }
    }
    const audioBuffer = Buffer.concat(audioChunks);
    const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
    return {
      audio: audioBlob,
      subtitle: wordBoundaries
    };
  }
};

// Helper exports
export class UniversalEdgeTTS extends EdgeTTS {}
