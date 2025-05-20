import { GoogleGenerativeAI } from '@google/generative-ai';
import dayjs from 'dayjs';

// API Keys for document extraction
const API_KEYS = [
  "AIzaSyDIWy5BqTbG6MeZrClNUBotdLH50FVTV4g",
  "AIzaSyBa1dP2itIiQo0KNAC9RjsCkRE3uNBr7Bo",
  "AIzaSyDY_ZSe1vuhRD5UYgZUMGHhaRWcvX-y-xc",
  "AIzaSyBc4oMdIlZ3S8iAmF0zvkXE5rMZogCLn-E",
  "AIzaSyDK412jbbryCptV3_ZTn5317eDLmqJcWXk",
  "AIzaSyDGxMdusljbpBshkhQTbJlgUxQPL668KWU",
  "AIzaSyAs-W7FeOOQX2UEPPMnC25-3KnbcGWLXDM",
  "AIzaSyBYFl2BVEEdElVeadmIqqEzkPxkXsSJerM",
  "AIzaSyDlO6S8KRwb0fywhTPeSqyMr_BLlBvJgZU",
  "AIzaSyBBMJ4lBc2PI3UMsAnXiyZcKShoWUU5RvI"
];

// Track rate limits for each API key
const apiKeyStatus = new Map<string, {
  lastUsed: number;
  failureCount: number;
  cooldownUntil: number;
}>();

// Initialize status for all API keys
API_KEYS.forEach(key => {
  apiKeyStatus.set(key, {
    lastUsed: 0,
    failureCount: 0,
    cooldownUntil: 0
  });
});

class APIKeyManager {
  private static instance: APIKeyManager;
  private currentIndex: number = 0;
  private genAIInstance: GoogleGenerativeAI;

  private constructor() {
    this.genAIInstance = new GoogleGenerativeAI(API_KEYS[this.currentIndex]);
  }

  public static getInstance(): APIKeyManager {
    if (!APIKeyManager.instance) {
      APIKeyManager.instance = new APIKeyManager();
    }
    return APIKeyManager.instance;
  }

  public get genAI(): GoogleGenerativeAI {
    return this.genAIInstance;
  }

  public get currentApiKeyIndex(): number {
    return this.currentIndex;
  }

  public get currentApiKey(): string {
    return API_KEYS[this.currentIndex];
  }

  public markApiKeyFailure(key: string): void {
    const status = apiKeyStatus.get(key);
    if (status) {
      status.failureCount++;
      status.cooldownUntil = dayjs().add(Math.pow(2, status.failureCount), 'minute').valueOf();
      apiKeyStatus.set(key, status);
    }
  }

  public getNextApiKey(): string {
    const now = dayjs().valueOf();
    let attempts = 0;
    
    while (attempts < API_KEYS.length) {
    this.currentIndex = (this.currentIndex + 1) % API_KEYS.length;
      const key = API_KEYS[this.currentIndex];
      const status = apiKeyStatus.get(key);
      
      if (status && now >= status.cooldownUntil) {
        status.lastUsed = now;
        apiKeyStatus.set(key, status);
        this.genAIInstance = new GoogleGenerativeAI(key);
        return key;
      }
      
      attempts++;
  }
  
    // If all keys are in cooldown, use the one with the earliest cooldown time
    let earliestCooldown = Infinity;
    let bestKey = API_KEYS[0];
    
    apiKeyStatus.forEach((status, key) => {
      if (status.cooldownUntil < earliestCooldown) {
        earliestCooldown = status.cooldownUntil;
        bestKey = key;
      }
    });
    
    this.genAIInstance = new GoogleGenerativeAI(bestKey);
    return bestKey;
  }
}

export const apiKeyManager = APIKeyManager.getInstance();
