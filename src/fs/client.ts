import axios, { AxiosInstance } from 'axios';
import { env } from '../env.js';

export class FacturaScriptsClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${env.FS_BASE_URL}/api/${env.FS_API_VERSION}`,
      headers: {
        'token': env.FS_API_TOKEN,
        'Content-Type': 'application/json',
      },
    });
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const response = await this.client.get<T>(endpoint, { params });
    return response.data;
  }

  async getWithPagination<T>(
    endpoint: string,
    limit: number = 50,
    offset: number = 0,
    additionalParams?: Record<string, any>
  ): Promise<{
    meta: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
    data: T[];
  }> {
    const params = {
      limit,
      offset,
      ...additionalParams,
    };

    const response = await this.client.get<T[]>(endpoint, { params });

    // FacturaScripts returns data directly as an array
    const dataArray = Array.isArray(response.data) ? response.data : [];
    
    // Extract total count from X-Total-Count header if available
    const totalCountHeader = response.headers['x-total-count'];
    const totalFromHeader = totalCountHeader ? parseInt(totalCountHeader, 10) : null;
    
    // Use header total if available, otherwise fall back to data length
    const total = totalFromHeader !== null && !isNaN(totalFromHeader) 
      ? totalFromHeader 
      : dataArray.length;
    
    // Calculate if there are more records based on total count
    const hasMore = totalFromHeader !== null 
      ? (offset + limit < total)
      : (dataArray.length === limit); // If we got a full page, assume there might be more

    return {
      meta: {
        total,
        limit,
        offset,
        hasMore,
      },
      data: dataArray,
    };
  }

  async getRaw(endpoint: string, params?: Record<string, any>): Promise<Response> {
    const axiosResponse = await this.client.get(endpoint, { 
      params,
      responseType: 'arraybuffer',
      validateStatus: () => true // Don't throw on non-2xx status codes
    });
    
    // Convert axios response to fetch-like Response
    return new Response(axiosResponse.data, {
      status: axiosResponse.status,
      statusText: axiosResponse.statusText,
      headers: new Headers(axiosResponse.headers as Record<string, string>)
    });
  }

  /**
   * Flatten nested objects into form-urlencoded format.
   * Arrays are serialized as field[0][key]=value, field[1][key]=value, etc.
   * @param data Object to flatten
   * @param prefix Optional prefix for nested keys
   * @returns URLSearchParams ready for POST/PUT
   */
  private toFormData(data: Record<string, any>, prefix?: string): URLSearchParams {
    const params = new URLSearchParams();

    const flatten = (obj: any, currentPrefix?: string) => {
      for (const [key, value] of Object.entries(obj)) {
        const paramKey = currentPrefix ? `${currentPrefix}[${key}]` : key;

        if (value === null || value === undefined) {
          continue;
        } else if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (typeof item === 'object' && item !== null) {
              flatten(item, `${paramKey}[${index}]`);
            } else {
              params.append(`${paramKey}[${index}]`, String(item));
            }
          });
        } else if (typeof value === 'object') {
          flatten(value, paramKey);
        } else {
          params.append(paramKey, String(value));
        }
      }
    };

    flatten(data, prefix);
    return params;
  }

  /**
   * Create a new record via POST request
   * FacturaScripts API expects form-urlencoded data, not JSON.
   * @param endpoint API endpoint (e.g., '/proveedores')
   * @param data Data to create
   * @returns Created record
   */
  async post<T>(endpoint: string, data: Record<string, any>): Promise<T> {
    const formData = this.toFormData(data);
    const response = await this.client.post<T>(endpoint, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  }

  /**
   * Update an existing record via PUT request
   * FacturaScripts API expects form-urlencoded data, not JSON.
   * @param endpoint API endpoint (e.g., '/proveedores/PROV001')
   * @param data Data to update
   * @returns Updated record
   */
  async put<T>(endpoint: string, data: Record<string, any>): Promise<T> {
    const formData = this.toFormData(data);
    const response = await this.client.put<T>(endpoint, formData.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  }

  /**
   * Delete a record via DELETE request
   * @param endpoint API endpoint (e.g., '/proveedores/PROV001')
   * @returns Deletion confirmation
   */
  async delete<T>(endpoint: string): Promise<T> {
    const response = await this.client.delete<T>(endpoint);
    return response.data;
  }
}
