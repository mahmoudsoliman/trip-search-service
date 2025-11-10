import { setTimeout as setTimeoutPromise } from 'node:timers/promises';

import type { Trip } from '../../domain/SavedTrip';
import type { TripsProvider } from '../../domain/ports/TripsProvider';
import { ApplicationError } from '../../utils/errors';
import { logger } from '../obs/logger';

interface TripsApiClientOptions {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
  retryAttempts: number;
}

interface TripsApiResponse {
  trips: Trip[];
}

export class TripsApiClient implements TripsProvider {
  private readonly baseUrl: URL;

  constructor(private readonly options: TripsApiClientOptions) {
    if (!options.baseUrl) {
      throw new Error('Trips API base URL must be configured');
    }

    this.baseUrl = new URL(options.baseUrl);
  }

  async searchTrips(input: { origin: string; destination: string }): Promise<Trip[]> {
    const url = new URL('/default/trips', this.baseUrl);
    url.searchParams.set('origin', input.origin);
    url.searchParams.set('destination', input.destination);

    const response = await this.executeWithRetries(url);
    const data = (await response.json()) as TripsApiResponse | Trip[];

    if (Array.isArray(data)) {
      return data;
    }

    return data.trips;
  }

  async getTripById(tripId: string): Promise<Trip | null> {
    const url = new URL(`/default/trips/${tripId}`, this.baseUrl);

    try {
      const response = await this.executeWithRetries(url);
      const data = (await response.json()) as Trip;
      return data;
    } catch (error) {
      if (error instanceof ApplicationError && error.statusCode === 404) {
        return null;
      }

      throw error;
    }
  }

  private async executeWithRetries(url: URL): Promise<Response> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.options.retryAttempts) {
      try {
        return await this.performRequest(url);
      } catch (error) {
        if (error instanceof ApplicationError && error.statusCode < 500) {
          throw error;
        }

        lastError = error;
        attempt += 1;

        if (attempt > this.options.retryAttempts) {
          break;
        }

        const delay = attempt * 100;
        logger.warn(
          { err: error, url: url.toString(), attempt },
          'Trip API request failed, retrying',
        );
        await setTimeoutPromise(delay);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Trips API request failed after retries');
  }

  private async performRequest(url: URL): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.options.apiKey ? { 'x-api-key': `${this.options.apiKey}` } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new ApplicationError(
          `Trips API responded with ${response.status} ${response.statusText}`,
          response.status,
          {
            body,
            url: url.toString(),
          },
        );
      }

      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Trips API request timed out');
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

