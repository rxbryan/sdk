import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { getEnvVariable } from '../config';

describe('config.ts', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  describe('config', () => {
    test('should be able to change configuration from process.env', async () => {
      const customUrl = 'https://test.cypherock.com';

      process.env.CY_BASE_URL = customUrl;

      const { config } = await import('../config');

      expect(config).toBeDefined();
      expect(config.CY_BASE_URL).toEqual(customUrl);
    });

    test('should have default value with no external configuration', async () => {
      const { config } = await import('../config');

      expect(config).toBeDefined();
      expect(config.CY_BASE_URL).toEqual('https://api.cypherock.com');
    });
  });

  describe('getEnvVariable', () => {
    test('should throw error when required field is not found', async () => {
      expect(() => getEnvVariable('TEST')).toThrowError();
    });
  });
});